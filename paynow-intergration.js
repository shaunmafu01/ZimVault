// api/paynow-initiate.js
const Paynow = require('paynow');

const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { amount, phone, contentId, buyerPhone } = req.body;
  const platformFee = amount * 0.10; // Your 10%
  const creatorPayout = amount - platformFee;
  
  const payment = paynow.createPayment('ZimVault Purchase', buyerPhone);
  payment.add('Content Unlock', amount);
  
  try {
    const response = await paynow.sendMobile(payment, phone, 'ecocash');
    
    if (response.success) {
      // Save to Supabase here (pseudo-code)
      // await supabase.from('transactions').insert({...})
      
      return res.status(200).json({
        success: true,
        reference: response.pollUrl,
        instructions: 'Check your phone to authorize payment'
      });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
