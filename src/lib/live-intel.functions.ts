import { createServerFn } from "@tanstack/react-start";
import {
  fetchLiveIntelligenceHandler,
  syncLiveIntelligenceHandler,
} from "./live-intel.server";

export const getLiveIntelligence = createServerFn({ method: "GET" }).handler(async () => {
  return fetchLiveIntelligenceHandler();
});

export const syncLiveIntelligence = createServerFn({ method: "POST" }).handler(async () => {
  return syncLiveIntelligenceHandler();
});
