/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as actions from "../actions.js";
import type * as auth from "../auth.js";
import type * as bids from "../bids.js";
import type * as categories from "../categories.js";
import type * as chats from "../chats.js";
import type * as fileUpload from "../fileUpload.js";
import type * as jobs from "../jobs.js";
import type * as lib_tokenGenerator from "../lib/tokenGenerator.js";
import type * as messageStatus from "../messageStatus.js";
import type * as messages from "../messages.js";
import type * as ratings from "../ratings.js";
import type * as sessions from "../sessions.js";
import type * as sms from "../sms.js";
import type * as systemMessages from "../systemMessages.js";
import type * as users from "../users.js";
import type * as workerJobs from "../workerJobs.js";
import type * as workerOnboarding from "../workerOnboarding.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  auth: typeof auth;
  bids: typeof bids;
  categories: typeof categories;
  chats: typeof chats;
  fileUpload: typeof fileUpload;
  jobs: typeof jobs;
  "lib/tokenGenerator": typeof lib_tokenGenerator;
  messageStatus: typeof messageStatus;
  messages: typeof messages;
  ratings: typeof ratings;
  sessions: typeof sessions;
  sms: typeof sms;
  systemMessages: typeof systemMessages;
  users: typeof users;
  workerJobs: typeof workerJobs;
  workerOnboarding: typeof workerOnboarding;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
