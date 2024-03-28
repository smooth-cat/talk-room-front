export const DateString = (temp: string) => {

  const date = new Date();
  const obj = {
    YYYY: date.getFullYear(),
    MM: date.getMonth(),
    DD: date.getDate(),
    HH: date.getHours(),
    mm: date.getMinutes(),
    ss: date.getSeconds(),
  }

  const replaced = temp.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => {
    const v = String(obj[match]);
    const len = match.length;
    return v.padStart(len, '0');
  })
  return replaced;
}