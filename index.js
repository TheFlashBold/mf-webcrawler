const WebcrawlerModule = require('./lib/WebcrawlerModule');
const CrawledPageModel = require('./models/CrawledPage');

module.exports = {
    module: WebcrawlerModule,
    data: {
        models: {
            crawledPage: CrawledPageModel
        }
    }
};
