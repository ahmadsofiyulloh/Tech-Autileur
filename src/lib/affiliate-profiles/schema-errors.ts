function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Affiliate profile operation failed.";
}

export function isAffiliateProfileSchemaMissingError(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    errorCode(error) === "42P01" ||
    errorCode(error) === "42704" ||
    errorCode(error) === "42703" ||
    message.includes("affiliate profile schema is not applied") ||
    message.includes("schema cache") ||
    (message.includes("column") && message.includes("does not exist") && message.includes("affiliate_profiles")) ||
    (message.includes("could not find the table") && message.includes("affiliate_profile_workspace_links")) ||
    (message.includes("could not find the table") && message.includes("affiliate_profiles")) ||
    (message.includes("relation") && message.includes("affiliate_profiles") && message.includes("does not exist")) ||
    (message.includes("relation") && message.includes("affiliate_profile_workspace_links") && message.includes("does not exist")) ||
    (message.includes("type") &&
      (message.includes("affiliate_platform") || message.includes("affiliate_profile_status")) &&
      message.includes("does not exist"))
  );
}
