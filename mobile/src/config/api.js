import { Platform } from "react-native";
import Constants from "expo-constants";

function getExpoHost() {
  const hostFromExpoConfig = Constants.expoConfig?.hostUri?.split(":")[0];
  const hostFromManifest = Constants.manifest2?.extra?.expoClient?.hostUri?.split(":")[0];
  return hostFromExpoConfig || hostFromManifest || "";
}

const fallbackHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const resolvedHost = getExpoHost() || fallbackHost;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${resolvedHost}:4000`;
