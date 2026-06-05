import {
  BRAND_GENESIS, BRAND_HYUNDAI, BRAND_KIA, BRANDS,
  CHARGE_PORT_ACTION, ORDER_STATUS,
  REGION_AUSTRALIA, REGION_BRAZIL, REGION_CANADA, REGION_CHINA,
  REGION_EUROPE, REGION_INDIA, REGION_NZ, REGION_USA, REGIONS,
  VALET_MODE_ACTION, VEHICLE_LOCK_ACTION,
} from "../constants/index.js";
import { APIError } from "../exceptions/index.js";
import { ApiImpl } from "./ApiImpl.js";
import { KiaUvoApiCA } from "./implementations/KiaUvoApiCA.js";
import { KiaUvoApiEU } from "./implementations/KiaUvoApiEU.js";
import { HyundaiBlueLinkApiUSA } from "./implementations/HyundaiBlueLinkApiUSA.js";
import { KiaUvoApiUSA } from "./implementations/KiaUvoApiUSA.js";
import { KiaUvoApiCN } from "./implementations/KiaUvoApiCN.js";
import { KiaUvoApiAU } from "./implementations/KiaUvoApiAU.js";
import { KiaUvoApiIN } from "./implementations/KiaUvoApiIN.js";
import { HyundaiBlueLinkApiBR } from "./implementations/HyundaiBlueLinkApiBR.js";

export function getApiImplementation(region: number, brand: number, language: string): ApiImpl {
  const regionName = REGIONS[region];
  const brandName = BRANDS[brand];

  if (regionName === REGION_CANADA) return new KiaUvoApiCA(region, brand, language);
  if (regionName === REGION_EUROPE) return new KiaUvoApiEU(region, brand, language);
  if (regionName === REGION_USA && (brandName === BRAND_HYUNDAI || brandName === BRAND_GENESIS)) {
    return new HyundaiBlueLinkApiUSA(region, brand, language);
  }
  if (regionName === REGION_USA && brandName === BRAND_KIA) return new KiaUvoApiUSA(region, brand, language);
  if (regionName === REGION_CHINA) return new KiaUvoApiCN(region, brand, language);
  if (regionName === REGION_AUSTRALIA) return new KiaUvoApiAU(region, brand, language);
  if (regionName === REGION_NZ) {
    if (brandName === BRAND_KIA) return new KiaUvoApiAU(region, brand, language);
    throw new APIError(`Unknown brand ${brandName} for region ${regionName}`);
  }
  if (regionName === REGION_INDIA) return new KiaUvoApiIN(brand);
  if (regionName === REGION_BRAZIL) return new HyundaiBlueLinkApiBR(region, brand, language);

  throw new APIError(`Unknown region ${region}`);
}
