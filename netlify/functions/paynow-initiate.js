const { createClient } = require('@supabase/supabase-js');
const Paynow = require('paynow');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

function normalizePhone(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\s+/g, '').replace(/[^0-9]/g, '');
  return cleaned.startsWith('0') ? cleaned : `0${cleaned}`;
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { amount, phone, buyerPhone, contentId, title, creatorId } = body;

    if (!amount || !phone || !buyerPhone) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing payment details' })
      };
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid payment amount' })
      };
    }

    const normalizedPhone = normalizePhone(phone);
    const normalizedBuyerPhone = normalizePhone(buyerPhone);
    const platformFee = numericAmount * 0.10;
    const creatorPayout = numericAmount - platformFee;

    const payment = paynow.createPayment('ZimVault Purchase', normalizedBuyerPhone);
    payment.add(`Content Unlock: ${title || 'Creator Content'}`, numericAmount);

    const response = await paynow.sendMobile(payment, normalizedPhone, 'ecocash');

    if (!response || !response.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: response?.message || 'PayNow request failed'
        })
      };
    }

    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert([
        {
          content_id: contentId || null,
          creator_id: creatorId || null,
          buyer_phone: normalizedBuyerPhone,
          amount: numericAmount,
          platform_fee: platformFee,
          creator_payout: creatorPayout,
          status: 'pending',
          reference: response.pollUrl || response.reference || null,
          payment_provider: 'paynow'
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert failed:', insertError);
    }

    if (transaction) {
      const { error: unlockError } = await supabase
        .from('unlocks')
        .insert([
          {
            user_phone: normalizedBuyerPhone,
            content_id: contentId,
            transaction_id: transaction.id
          }
        ])
        .select();

      if (unlockError) {
        console.error('Unlock insert failed:', unlockError);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        reference: response.pollUrl || response.reference || 'pending',
        instructions: 'Check your phone to authorize payment',
        platformFee,
        creatorPayout
      })
    };
  } catch (error) {
    console.error('PayNow handler failed:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Payment processing failed'
      })
    };
  }
};
