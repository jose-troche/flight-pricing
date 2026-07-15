export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/**
 * Deep-merges a (possibly partial, possibly untrusted) overrides object
 * onto a complete base object. Arrays are merged element-wise (so, e.g.,
 * overriding just `demandShare` on each segment keeps the rest of that
 * segment's fields); extra base array elements beyond the override
 * array's length are preserved as-is. Used both to apply route-archetype
 * presets onto `DEFAULT_PARAMETERS` and, in the worker/web apps, to
 * safely fill in any fields a client omits before validation.
 */
export function deepMerge<T>(base: T, overrides: DeepPartial<T> | undefined | null): T {
  if (overrides === undefined || overrides === null) return base;

  if (Array.isArray(base) && Array.isArray(overrides)) {
    return base.map((item, i) => {
      if (i >= overrides.length) return item;
      const ov = (overrides as any[])[i];
      return typeof item === "object" && item !== null ? deepMerge(item, ov) : (ov ?? item);
    }) as unknown as T;
  }

  if (typeof base === "object" && base !== null && !Array.isArray(base)) {
    const result: any = { ...base };
    for (const key of Object.keys(overrides ?? {})) {
      const overrideVal = (overrides as any)[key];
      const baseVal = (base as any)[key];
      result[key] =
        typeof baseVal === "object" && baseVal !== null ? deepMerge(baseVal, overrideVal) : (overrideVal ?? baseVal);
    }
    return result;
  }

  return (overrides as unknown as T) ?? base;
}
