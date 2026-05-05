export type ProductWorkflowStage = "draft" | "analysis" | "prompt" | "video" | "upload";

export type ProductUploadScope = "none" | "shopee" | "tiktok" | "both";

export type ProductWorkflowStatusJson = {
  video_generated: boolean;
  uploaded_shopee: boolean;
  uploaded_tiktok: boolean;
};

export type ProductListRow = {
  id: string;
  product_code: string;
  product_name: string;
  niche: string | null;
  workspace_label: string;
  marketplace: string | null;
  marketplace_product_link: string | null;
  keyword: string;
  product_status: string;
  intake_status: string;
  created_at: string;
  created_at_label: string;
  thumbnail_url: string | null;
  href: string;
  continue_href: string | null;
  primary_status_label: string;
  status_context_label: string | null;
  workflow_stage: ProductWorkflowStage;
  upload_scope: ProductUploadScope;
  workflow_status_json: ProductWorkflowStatusJson;
  search_text: string;
};
