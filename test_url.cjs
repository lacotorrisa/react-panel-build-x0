const https = require('https');
https.get('https://react-panel-build-x0.vercel.app/', (res) => {
  let html = '';
  res.on('data', (d) => { html += d; });
  res.on('end', () => {
    const match = html.match(/src=\"(\/assets\/index-[^\"]+\.js)\"/);
    if (!match) return console.log('No script found');
    const jsUrl = 'https://react-panel-build-x0.vercel.app' + match[1];
    https.get(jsUrl, (r) => {
      let js = '';
      r.on('data', (d) => { js += d; });
      r.on('end', () => {
        if (js.includes('irigoyen@colivery.mx')) console.log('NEW CODE!');
        else console.log('OLD CODE!');
      });
    });
  });
});
