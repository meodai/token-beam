-- Adapted from https://github.com/behreajj/AsepriteOkHsl/blob/main/ok_color.lua
-- Copyright (c) 2021 Bjorn Ottosson
-- MIT License

local ok_color = {}

function ok_color.srgb_transfer_function_inv(a)
  if 0.04045 < a then
    return ((a + 0.055) * 0.9478672985781991) ^ 2.4
  end

  return a * 0.07739938080495357
end

function ok_color.linear_srgb_to_oklab(cr, cg, cb)
  local l = (0.4121764591770371 * cr
    + 0.5362739742695891 * cg
    + 0.05144037229550143 * cb) ^ 0.3333333333333333
  local m = (0.21190919958804857 * cr
    + 0.6807178709823131 * cg
    + 0.10739984387775398 * cb) ^ 0.3333333333333333
  local s = (0.08834481407213204 * cr
    + 0.28185396309857735 * cg
    + 0.6302808688015096 * cb) ^ 0.3333333333333333

  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
end

function ok_color.srgb_to_oklab(red, green, blue)
  return ok_color.linear_srgb_to_oklab(
    ok_color.srgb_transfer_function_inv(red),
    ok_color.srgb_transfer_function_inv(green),
    ok_color.srgb_transfer_function_inv(blue)
  )
end

return ok_color