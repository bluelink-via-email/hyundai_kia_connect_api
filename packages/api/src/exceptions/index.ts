export class HyundaiKiaException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "HyundaiKiaException";
  }
}

export class PINMissingError extends HyundaiKiaException {
  constructor(message?: string) {
    super(message);
    this.name = "PINMissingError";
  }
}

export class AuthenticationError extends HyundaiKiaException {
  constructor(message?: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthenticationOTPRequired extends AuthenticationError {
  constructor(message?: string) {
    super(message);
    this.name = "AuthenticationOTPRequired";
  }
}

export class ConsentRequiredError extends AuthenticationError {
  constructor(message?: string) {
    super(message);
    this.name = "ConsentRequiredError";
  }
}

export class APIError extends HyundaiKiaException {
  constructor(message?: string) {
    super(message);
    this.name = "APIError";
  }
}

export class DeviceIDError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "DeviceIDError";
  }
}

export class RateLimitingError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "RateLimitingError";
  }
}

export class NoDataFound extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "NoDataFound";
  }
}

export class ServiceTemporaryUnavailable extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "ServiceTemporaryUnavailable";
  }
}

export class DuplicateRequestError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "DuplicateRequestError";
  }
}

export class UnsupportedControlError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "UnsupportedControlError";
  }
}

export class RequestTimeoutError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export class InvalidAPIResponseError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidAPIResponseError";
  }
}
