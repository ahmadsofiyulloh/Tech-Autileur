"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/operator/status-badge";
import { mockProviderStatus, mockToolOptions } from "@/lib/ai-media/mock-data";
import { AiMediaOptionPicker } from "./ai-media-option-picker";

export function AiMediaProviderStep() {
  const [selectedKey, setSelectedKey] = useState(mockToolOptions.keys[0].id);
  const provider = mockProviderStatus;

  return (
    <div className="stack">
      <div className="ai-media-step-field">
        <span className="ai-media-step-field__label">Status</span>
        <StatusBadge status={provider.state === "active" ? "ACTIVE" : "MISSING"} size="sm" />
      </div>
      <div className="ai-media-step-field">
        <span className="ai-media-step-field__label">Fallback</span>
        <StatusBadge status={provider.fallbackReady ? "READY" : "NOT READY"} size="sm" />
      </div>
      <AiMediaOptionPicker label="Kunci API" options={mockToolOptions.keys} value={selectedKey} onChange={setSelectedKey} />
    </div>
  );
}
