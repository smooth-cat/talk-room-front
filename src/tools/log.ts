export class Con {
  shouldLog = false;
  log = (msg, tip='') => {
    if(this.shouldLog) {
      const tipStr = `\nWS----------------${tip}----------------WS\n`;
      console.log(tipStr, msg);
    }
  }
}
