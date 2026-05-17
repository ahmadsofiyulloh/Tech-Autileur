export type JsonApiSuccess<T> = {
  ok: true;
  data: T;
};

export type JsonApiFailure = {
  ok: false;
  error: {
    message: string;
    code: string;
  };
};

export type JsonApiResponse<T> = JsonApiSuccess<T> | JsonApiFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isJsonApiSuccess<T = unknown>(value: unknown): value is JsonApiSuccess<T> {
  return isRecord(value) && value.ok === true && "data" in value;
}

export function isJsonApiFailure(value: unknown): value is JsonApiFailure {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) {
    return false;
  }

  return typeof value.error.message === "string" && typeof value.error.code === "string";
}

export function unwrapJsonApiData<T>(payload: T | JsonApiResponse<T>): T {
  if (isJsonApiSuccess<T>(payload)) {
    return payload.data;
  }

  return payload as T;
}

export function readJsonApiErrorMessage(payload: unknown, fallbackMessage: string) {
  if (isJsonApiFailure(payload)) {
    return payload.error.message;
  }

  if (isRecord(payload)) {
    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (isRecord(payload.error) && typeof payload.error.message === "string") {
      return payload.error.message;
    }
  }

  return fallbackMessage;
}
