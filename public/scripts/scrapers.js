import { getRequestHeaders } from '../script.js';
import { renderExtensionTemplateAsync } from './extensions.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from './popup.js';
import { isValidUrl } from './utils.js';

/**
 * @typedef {Object} Scraper
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} iconClass
 * @property {() => Promise<boolean>} isAvailable
 * @property {() => Promise<File[]>} scrape
 */

/**
 * @typedef {Object} ScraperInfo
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} iconClass
 */

export class ScraperManager {
    /**
     * @type {Scraper[]}
     */
    static #scrapers = [];

    /**
     * Register a scraper to be used by the Data Bank.
     * @param {Scraper} scraper Instance of a scraper to register
     */
    static registerDataBankScraper(scraper) {
        if (ScraperManager.#scrapers.some(s => s.id === scraper.id)) {
            console.warn(`Scraper with ID ${scraper.id} already registered`);
            return;
        }

        ScraperManager.#scrapers.push(scraper);
    }

    /**
     * Gets a list of scrapers available for the Data Bank.
     * @returns {ScraperInfo[]} List of scrapers available for the Data Bank
     */
    static getDataBankScrapers() {
        return ScraperManager.#scrapers.map(s => ({ id: s.id, name: s.name, description: s.description, iconClass: s.iconClass }));
    }

    /**
     * Run a scraper to scrape data into the Data Bank.
     * @param {string} scraperId ID of the scraper to run
     * @returns {Promise<File[]>} List of files scraped by the scraper
     */
    static runDataBankScraper(scraperId) {
        const scraper = ScraperManager.#scrapers.find(s => s.id === scraperId);
        if (!scraper) {
            console.warn(`Scraper with ID ${scraperId} not found`);
            return;
        }
        return scraper.scrape();
    }

    /**
     * Check if a scraper is available.
     * @param {string} scraperId ID of the scraper to check
     * @returns {Promise<boolean>} Whether the scraper is available
     */
    static isScraperAvailable(scraperId) {
        const scraper = ScraperManager.#scrapers.find(s => s.id === scraperId);
        if (!scraper) {
            console.warn(`Scraper with ID ${scraperId} not found`);
            return;
        }
        return scraper.isAvailable();
    }
}

/**
 * Scrape data from a webpage.
 * @implements {Scraper}
 */
class WebScraper {
    constructor() {
        this.id = 'web';
        this.name = 'Web';
        this.description = 'Download a page from the web.';
        this.iconClass = 'fa-solid fa-globe';
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    isAvailable() {
        return Promise.resolve(true);
    }

    /**
    * Parse the title of an HTML file from a Blob.
    * @param {Blob} blob Blob of the HTML file
    * @returns {Promise<string>} Title of the HTML file
    */
    async getTitleFromHtmlBlob(blob) {
        const text = await blob.text();
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        return titleMatch ? titleMatch[1] : '';
    }

    /**
     * Scrape file attachments from a webpage.
     * @returns {Promise<File[]>} File attachments scraped from the webpage
     */
    async scrape() {
        const template = $(await renderExtensionTemplateAsync('attachments', 'web-scrape', {}));
        const linksString = await callGenericPopup(template, POPUP_TYPE.INPUT, '', { wide: false, large: false, okButton: 'Scrape', cancelButton: 'Cancel', rows: 4 });

        if (!linksString) {
            return;
        }

        const links = String(linksString).split('\n').map(l => l.trim()).filter(l => l).filter(l => isValidUrl(l));

        if (links.length === 0) {
            toastr.error('Invalid URL');
            return;
        }

        const toast = toastr.info('Working, please wait...');

        const files = [];

        for (const link of links) {
            const result = await fetch('/api/serpapi/visit', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ url: link }),
            });

            const blob = await result.blob();
            const domain = new URL(link).hostname;
            const timestamp = Date.now();
            const title = await this.getTitleFromHtmlBlob(blob) || 'webpage';
            const file = new File([blob], `${title} - ${domain} - ${timestamp}.html`, { type: 'text/html' });
            files.push(file);
        }

        toastr.clear(toast);
        return files;
    }
}

/**
 * Scrape data from a file selection.
 * @implements {Scraper}
 */
class FileScraper {
    constructor() {
        this.id = 'file';
        this.name = 'File';
        this.description = 'Upload a file from your computer.';
        this.iconClass = 'fa-solid fa-upload';
    }

    /**
     * Check if the scraper is available.
     * @returns {Promise<boolean>}
     */
    isAvailable() {
        return Promise.resolve(true);
    }

    /**
     * Scrape file attachments from a file.
     * @returns {Promise<File[]>} File attachments scraped from the files
     */
    async scrape() {
        return new Promise(resolve => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.txt, .md, .pdf, .html, .htm';
            fileInput.multiple = true;
            fileInput.onchange = () => resolve(Array.from(fileInput.files));
            fileInput.click();
        });
    }
}

/**
 * Scrape data from a Fandom wiki.
 * @implements {Scraper}
 */
class FandomScraper {
    constructor() {
        this.id = 'fandom';
        this.name = 'Fandom';
        this.description = 'Download a page from the Fandom wiki.';
        this.iconClass = 'fa-solid fa-fire';
    }

    async isAvailable() {
        try {
            const result = await fetch('/api/plugins/fandom/probe', {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            return result.ok;
        } catch (error) {
            console.debug('Could not probe Fandom plugin', error);
            return false;
        }
    }

    /**
     * Get the ID of a fandom from a URL or name.
     * @param {string} fandom URL or name of the fandom
     * @returns {string} ID of the fandom
     */
    getFandomId(fandom) {
        try {
            const url = new URL(fandom);
            return url.hostname.split('.')[0] || fandom;
        } catch {
            return fandom;
        }
    }

    async scrape() {
        let fandom = '';
        let filter = '';
        let output = 'single';

        const template = $(await renderExtensionTemplateAsync('attachments', 'fandom-scrape', {}));
        template.find('input[name="fandomScrapeInput"]').on('input', function () {
            fandom = String($(this).val()).trim();
        });
        template.find('input[name="fandomScrapeFilter"]').on('input', function () {
            filter = String($(this).val());
        });
        template.find('input[name="fandomScrapeOutput"]').on('input', function () {
            output = String($(this).val());
        });

        const confirm = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { wide: false, large: false, okButton: 'Scrape', cancelButton: 'Cancel' });

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        if (!fandom) {
            toastr.error('Fandom name is required');
            return;
        }

        const toast = toastr.info('Working, please wait...');

        const result = await fetch('/api/plugins/fandom/scrape', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ fandom, filter }),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const data = await result.json();
        toastr.clear(toast);

        if (output === 'multi') {
            const files = [];
            for (const attachment of data) {
                const file = new File([String(attachment.content).trim()], `${String(attachment.title).trim()}.txt`, { type: 'text/plain' });
                files.push(file);
            }
            return files;
        }

        if (output === 'single') {
            const combinedContent = data.map((a) => String(a.title).trim() + '\n\n' + String(a.content).trim()).join('\n\n\n\n');
            const file = new File([combinedContent], `${fandom}.txt`, { type: 'text/plain' });
            return [file];
        }

        return [];
    }
}

ScraperManager.registerDataBankScraper(new FileScraper());
ScraperManager.registerDataBankScraper(new WebScraper());
ScraperManager.registerDataBankScraper(new FandomScraper());
