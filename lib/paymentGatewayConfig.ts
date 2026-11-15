
import 'server-only';

export type PaymentGatewayProvider =
  | 'simulation'
  | 'peach';

export type PaymentGatewayMode =
  | 'disabled'
  | 'test';

export type PaymentGatewayConfig = {
  provider: PaymentGatewayProvider;
  mode: PaymentGatewayMode;
  canCreateRealCharges: false;
  canCreateSupplierBookings: false;
};

export function getPaymentGatewayConfig():
  PaymentGatewayConfig {
  const previewEnabled =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.TEST_ORDER_CREATION_ENABLED === 'true';

  if (!previewEnabled) {
    return {
      provider: 'simulation',
      mode: 'disabled',
      canCreateRealCharges: false,
      canCreateSupplierBookings: false,
    };
  }

  return {
    provider: 'simulation',
    mode: 'test',
    canCreateRealCharges: false,
    canCreateSupplierBookings: false,
  };
}
