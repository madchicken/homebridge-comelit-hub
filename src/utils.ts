/**
 * Returns the position as a value between 0 and 255.
 * Since Comelit system uses 0 for opened and 100 for closed, this function inverts the percentage to accommodate
 * the value for Homekit, that uses 0 for closed nad 100 for fully opened.
 * @param position number 0-100
 */
export function getPositionAsByte(position: number): number {
  return Math.round((100 - position) * 2.55);
}

/**
 * Returns the position as a value between 0 and 100
 * Since Comelit system uses 0 for opened and 100 for closed, this function inverts the percentage to accommodate
 * the value for Homekit, that uses 0 for closed and 100 for fully opened.
 * @param position number 0-255
 */
export function getPositionAsPerc(position: string): number {
  let number = 0;
  try {
    number = parseInt(position);
  } catch (_e) {
    // no op, use default (0)
  }
  return Math.round(100 - number / 2.55);
}
