"use client";

import { Suspense } from "react";
import { ActivityFeedbackHost } from "./activity-feedback-host";
import { RouteToaster } from "./route-toaster";

export function FeedbackDock() {
  return (
    <div className="feedback-dock">
      <Suspense fallback={null}>
        <RouteToaster />
      </Suspense>
      <ActivityFeedbackHost />
    </div>
  );
}
