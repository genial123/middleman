var Btn = require('../lib/btn')

var btn = new Btn('')

btn.search().limit(1).container('mp4').resolution('sd').run(console.log)

btn.getUserSnatchlist(50, console.log)

btn.userInfo(console.log)

btn.getChangelog(console.log)

btn.getInbox(console.log)