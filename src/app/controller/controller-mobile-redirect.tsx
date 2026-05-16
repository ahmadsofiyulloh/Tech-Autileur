"use client";

import { useEffect } from "react";

const MOBILE_CONTROLLER_MEDIA_QUERY = "(max-width: 860px)";
const MOBILE_CONTROLLER_MAX_WIDTH = 860;

export function ControllerMobileRedirect() {
  useEffect(() => {
    const isMobileViewport =
      window.innerWidth <= MOBILE_CONTROLLER_MAX_WIDTH ||
      (typeof window.matchMedia === "function" && window.matchMedia(MOBILE_CONTROLLER_MEDIA_QUERY).matches);

    if (isMobileViewport && window.location.pathname !== "/products/new") {
      window.location.replace("/products/new");
    }
  }, []);

  return null;
}
