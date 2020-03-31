const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const {Module, Modules:{request}} = require('mf-lib');
const puppeteer = require('puppeteer-extra');
const Database = require('mf-database');
const cheerio = require('cheerio');
const moment = require('moment');
puppeteer.use(StealthPlugin());

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

class HtmlCrawler {
    select = null;
    schema = {};

    constructor(doc, schema) {
        this.select = cheerio.load(doc);
        this.schema = schema;
    }

    getData() {
        return this.getValue(this.schema, this.select);
    }

    getValue(config, select) {
        if (typeof select !== "function") {
            console.log("[ERROR] seems like your config is wrong :$");
            return null;
        }

        const data = {};
        for (let [key, cfg] of Object.entries(config)) {
            let entry = null;
            const {path, attr, array, properties, modifier} = this._getConfig(cfg);

            const element = path ? select(path) : select();
            let selector = (e) => e;

            if (attr) {
                selector = (e) => select(e).attr(attr);
            } else {
                selector = (e) => select(e).text().trim();
            }

            if (!path && properties) {
                entry = this.getValue(properties, select);
            } else if (array && properties) {
                entry = Utils.fixArray(element).map((e) => {
                    return this.getValue(properties, (path) => path ? select(path, e) : select(e));
                });
            } else if (array) {
                entry = Utils.fixArray(element).map(selector);
            } else if (properties) {
                entry = this.getValue(properties, element);
            } else {
                entry = selector(element);
                if (modifier) {
                    entry = this._applyModifier(entry, modifier);
                }
            }

            data[key] = entry;
        }
        return data;
    }

    // @TODO: make this great again
    _applyModifier(data, modifier) {
        if (!Array.isArray(modifier)) {
            modifier = [modifier];
        }

        for (let mod of modifier) {
            mod = this._getModifierConfig(mod);
            switch (mod.type) {
                case "regex":
                    const regex = new RegExp(mod.regex, mod.options || "");
                    const matches = regex.exec(data);
                    if (mod.first) {
                        data = matches[1] || null;
                    } else {
                        data = matches;
                    }
                    break;
                case "number":
                    data = parseFloat(data.replace(/[^0-9,.]/g, "").replace(/,/g, "."));
                    break;
            }
        }

        return data;
    }

    /**
     * Unifies config
     * @param {string|{path: string}} cfg
     * @return {{path: string}}
     * @private
     */
    _getConfig(cfg) {
        if (typeof cfg === "string") {
            cfg = {
                path: cfg
            };
        }

        return cfg;
    }

    _getModifierConfig(modifier) {
        if (typeof modifier === "string") {
            modifier = {
                type: modifier
            };
        }
        return modifier;
    }
}

/**
 * @type WebCrawlerModule
 */
class WebCrawlerModule extends Module {
    _browser = null;
    _presets = {};

    /**
     * @return {Promise<void>}
     */
    async init() {
        this._presets = this.config.get("presets", {});
    }

    /**
     * @param {string} url
     * @param {{preset: string, puppeteer: Boolean|undefined, cache: Number}} options
     * @returns {Promise<object>}
     */
    async crawlPage(url, options = {preset: "auto", cache: 3600}) {
        const {preset: presetName} = options;
        const doc = await this.loadPage(url, options);
        const preset = presetName === "auto" || !this._presets[presetName] ? this.findPreset(url) : this.findPreset(url);
        const data = await this.parsePage(doc, preset);

        let crawledPageModel = Database.getModel("crawledPage");
        let model = await crawledPageModel.findOne({
            url: url,
            timestamp: {
                $gt: moment().subtract(options.cache, "s")
            }
        });
        if (!model) {
            model = new crawledPageModel({
                url: url,
                data: data,
                preset: preset.name || presetName,
                timestamp: new Date()
            });
            await model.save();
        }

        return data;
    }

    /**
     * Find preset by supported url
     * @param {string} url
     * @return {{urls: [], schema: {}}}
     */
    findPreset(url) {
        for (const [presetName, preset] of Object.entries(this._presets)) {
            if (preset.urls.find((regex) => new RegExp(regex, "i").test(url))) {
                preset.name = presetName;
                return preset;
            }
        }
    }

    /**
     * @param {string} url
     * @param {{puppeteer: Boolean}} options
     * @returns {Promise<string>}
     */
    async loadPage(url, options = {}) {
        if (options.puppeteer) {
            if (!this._browser) {
                this._browser = new puppeteer.launch({headless: true});
            }

            const page = await this._browser.newPage();
            await page.goto(url);

            if (options.scrollToBottom) {
                await Utils.ScrollToBottom(page);
            }

            return page.content();
        }

        return request({
            method: "GET",
            url: url
        });
    }

    /**
     * @param {string} doc html document
     * @param {object} preset as object
     * @returns {object}
     */
    async parsePage(doc, preset) {
        const blah = new HtmlCrawler(doc, preset.schema);
        return blah.getData();
    }
}

const index = new WebCrawlerModule;
module.exports = index;

Database.registerModel("crawledPage", {
    preset: {
        type: String
    },
    url: {
        type: String
    },
    data: {
        type: Database.Types.Mixed
    },
    timestamp: {
        type: Date
    }
});
