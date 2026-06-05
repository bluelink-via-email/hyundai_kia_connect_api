export interface Token {
  username: string;
  password: string;
  access_token: string | null;
  refresh_token: string | null;
  device_id: string | null;
  valid_until: Date;
  stamp: string | null;
  pin: string | null;
}

export function tokenToDict(t: Token): Record<string, unknown> {
  return {
    username: t.username,
    password: t.password,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    device_id: t.device_id,
    valid_until: t.valid_until.toISOString(),
    stamp: t.stamp,
    pin: t.pin,
  };
}

export function tokenFromDict(data: Record<string, unknown>): Token {
  const vu = data["valid_until"];
  const valid_until =
    typeof vu === "string" ? new Date(vu) : new Date(0);
  return {
    username: data["username"] as string,
    password: data["password"] as string,
    access_token: (data["access_token"] as string | null) ?? null,
    refresh_token: (data["refresh_token"] as string | null) ?? null,
    device_id: (data["device_id"] as string | null) ?? null,
    valid_until,
    stamp: (data["stamp"] as string | null) ?? null,
    pin: (data["pin"] as string | null) ?? null,
  };
}

export function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    username: "",
    password: "",
    access_token: null,
    refresh_token: null,
    device_id: null,
    valid_until: new Date(0),
    stamp: null,
    pin: null,
    ...overrides,
  };
}
