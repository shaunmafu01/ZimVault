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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, phone, buyerPhone, contentId, title, creatorId } = req.body || {};

    if (!amount || !phone || !buyerPhone) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const normalizedPhone = normalizePhone(phone);
    const normalizedBuyerPhone = normalizePhone(buyerPhone);
    const platformFee = numericAmount * 0.10;
    const creatorPayout = numericAmount - platformFee;

    const payment = paynow.createPayment('ZimVault Purchase', normalizedBuyerPhone);
    payment.add(`Content Unlock: ${title || 'Creator Content'}`, numericAmount);

    const response = await paynow.sendMobile(payment, normalizedPhone, 'ecocash');

    if (!response || !response.success) {
      return res.status(400).json({
        success: false,
        error: response?.message || 'PayNow request failed'
      });
    }

    const transactionPayload = {
      content_id: contentId || null,
      title: title || 'Creator Content',
      buyer_phone: normalizedBuyerPhone,
      creator_id: creatorId || null,
      amount: numericAmount,
      platform_fee: platformFee,
      creator_payout: creatorPayout,
      status: 'pending',
      reference: response.pollUrl || response.reference || null
    };

    const { error: dbError } = await supabase
      .from('transactions')
      .insert([transactionPayload]);

    if (dbError) {
      console.error('Supabase insert failed:', dbError);
    }

    return res.status(200).json({
      success: true,
      reference: response.pollUrl || response.reference || 'pending',
      instructions: 'Check your phone to authorize payment',
      platformFee,
      creatorPayout
    });
  } catch (error) {
    console.error('PayNow handler failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment processing failed'
    });
  }
};
