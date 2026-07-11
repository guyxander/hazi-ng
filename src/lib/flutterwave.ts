type FlutterwaveCustomer = {
  email: string;
  name: string;
};

type InitializePaymentInput = {
  txRef: string;
  amount: number;
  redirectUrl: string;
  customer: FlutterwaveCustomer;
  title: string;
};

type FlutterwaveInitializeResponse = {
  status: string;
  message?: string;
  data?: {
    link?: string;
  };
};

type FlutterwaveVerifyResponse = {
  status: string;
  message?: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref?: string;
    status: string;
    currency: string;
    amount: number;
    charged_amount?: number;
    payment_type?: string;
  };
};

type FlutterwaveTransferInput = {
  accountBank: string;
  accountNumber: string;
  amount: number;
  narration: string;
  reference: string;
  beneficiaryName?: string | null;
};

type FlutterwaveTransferResponse = {
  status: string;
  message?: string;
  data?: {
    id?: number;
    reference?: string;
    status?: string;
    complete_message?: string;
  };
};

function getFlutterwaveSecretKey() {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Flutterwave is not configured yet.");
  }

  return secretKey;
}

export function isFlutterwaveConfigured() {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY && process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY);
}

export function verifyFlutterwaveWebhookSignature(signature: string | null) {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

  if (!secretHash) {
    return false;
  }

  return Boolean(signature) && signature === secretHash;
}

export async function initializeFlutterwavePayment(input: InitializePaymentInput) {
  const paymentOptions = process.env.FLUTTERWAVE_PAYMENT_OPTIONS || "card,account,banktransfer,ussd,opay";

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amount,
      currency: "NGN",
      payment_options: paymentOptions,
      redirect_url: input.redirectUrl,
      customer: input.customer,
      customizations: {
        title: input.title,
        description: input.title,
        logo: ""
      }
    })
  });

  const result = (await response.json()) as FlutterwaveInitializeResponse;

  if (!response.ok || result.status !== "success" || !result.data?.link) {
    throw new Error(result.message || "Could not start Flutterwave payment.");
  }

  return result.data.link;
}

export async function verifyFlutterwavePayment(transactionId: string) {
  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecretKey()}`
    }
  });

  const result = (await response.json()) as FlutterwaveVerifyResponse;

  if (!response.ok || result.status !== "success" || !result.data) {
    throw new Error(result.message || "Could not verify Flutterwave payment.");
  }

  return result.data;
}

export async function createFlutterwaveTransfer(input: FlutterwaveTransferInput) {
  const response = await fetch("https://api.flutterwave.com/v3/transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      amount: input.amount,
      narration: input.narration,
      currency: "NGN",
      reference: input.reference,
      beneficiary_name: input.beneficiaryName || undefined
    })
  });

  const result = (await response.json()) as FlutterwaveTransferResponse;

  if (!response.ok || result.status !== "success" || !result.data?.id) {
    throw new Error(result.message || result.data?.complete_message || "Could not create Flutterwave transfer.");
  }

  return {
    id: String(result.data.id),
    reference: result.data.reference || input.reference,
    status: result.data.status || "accepted",
    raw: result
  };
}
