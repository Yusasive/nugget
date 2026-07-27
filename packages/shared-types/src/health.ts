export type HealthStatus = "ok" | "error";

export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
  };
}
