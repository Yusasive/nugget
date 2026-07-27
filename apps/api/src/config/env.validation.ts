import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: Joi.number().default(7),
  /** PRD §5.2: "configurable booking hold/expiry window to prevent abandoned carts". */
  BOOKING_HOLD_MINUTES: Joi.number().default(15),
  /** Milestone 5 payment gateways — blank until real sandbox keys are added
   * (see README's "Manual setup still required"). Initiating a gateway
   * payment without one configured fails with a clear error rather than a
   * confusing call to Paystack/Flutterwave with an empty key. */
  PAYSTACK_SECRET_KEY: Joi.string().allow('').default(''),
  FLUTTERWAVE_SECRET_KEY: Joi.string().allow('').default(''),
  /** Flutterwave's webhook auth is a static configured hash compared
   * against the `verif-hash` header, not an HMAC like Paystack's. */
  FLUTTERWAVE_WEBHOOK_HASH: Joi.string().allow('').default(''),
});
