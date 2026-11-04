module.exports = function getDates(dayOffset = 0) {
  const now = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const year = now.getYear();
  let day = Math.floor(diff / oneDay);
  let dayOfMonth = now.getDate();
  if (now.getHours() < 18) {
    day--;

    if (dayOfMonth === 1) {
      dayOfMonth = -1;
    } else {
      dayOfMonth--;
    }
  }

  return {
    "day": (year * 1000) + day,
    "dayOfMonth": dayOfMonth,
  }
}
