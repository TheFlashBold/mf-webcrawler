/**
 * Utils for the WebCrawler
 */
class Utils {
    /**
     * Scroll to page bottom
     * @param {puppeteer.Page} page
     * @param {number} scrollDistance scroll x px
     * @param {number} interval scroll every x ms
     * @return {Promise<void>}
     * @constructor
     */
    static ScrollToBottom(page, scrollDistance = 500, interval = 100) {
        return page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;

                const timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, scrollDistance);
                    totalHeight += scrollDistance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, interval);
            });
        });
    }

    /**
     * Create array from an object with numeric keys and length :$
     * @param {array|object} notAnArray
     * @return {[*]}
     */
    static fixArray(notAnArray) {
        const data = [];

        if (!notAnArray || !notAnArray.length) {
            return data;
        }

        for (let i = 0; i < notAnArray.length; i++) {
            data.push(notAnArray[i]);
        }

        return data;
    }
}

module.exports = Utils;
