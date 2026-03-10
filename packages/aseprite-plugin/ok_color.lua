-- Adapted from https://github.com/behreajj/AsepriteOkHsl/blob/main/ok_color.lua
-- Original Oklab code and license reference:
-- https://bottosson.github.io/posts/oklab/
-- https://bottosson.github.io/misc/License.txt
--
-- Copyright (c) 2020 Bjorn Ottosson
--
-- Permission is hereby granted, free of charge,
-- to any person obtaining a copy of
-- this software and associated documentation
-- files (the "Software"), to deal in
-- the Software without restriction, including
-- without limitation the rights to
-- use, copy, modify, merge, publish, distribute,
-- sublicense, and/or sell copies
-- of the Software, and to permit persons to whom the
-- Software is furnished to do
-- so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
-- WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE
-- WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
-- NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
-- OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
-- FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
-- THE SOFTWARE.

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