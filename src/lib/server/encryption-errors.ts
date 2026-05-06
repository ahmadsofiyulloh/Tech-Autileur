import "server-only";

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

function readErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }

  return "";
}

export function isEncryptionAuthenticationError(error: unknown) {
  const code = readErrorCode(error);

  if (code === "ERR_OSSL_BAD_DECRYPT" || code === "ERR_CRYPTO_INVALID_AUTH_TAG") {
    return true;
  }

  const message = readErrorMessage(error).toLowerCase();

  return (
    message.includes("unsupported state or unable to authenticate data") ||
    message.includes("bad decrypt") ||
    message.includes("invalid authentication tag")
  );
}
