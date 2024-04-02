var ip = require('ip');
 
var addr = ip.address(); 

module.exports = {
  env: {
    NODE_ENV: '"development"',
    WsIp: `"${addr}"`
  },
  defineConstants: {
  },
  mini: {},
  h5: {}
}
