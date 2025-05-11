// ==UserScript==
// @name         YouTube Shorts Remover (v1.0)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Removes shorts from YouTube
// @author       Aksor9
// @license      MIT
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const config = {
        // --- Configuraciones ---
        REMOVE_FROM_HOME: true,
        REMOVE_FROM_SUBSCRIPTIONS: true,
        REMOVE_FROM_CHANNEL: true,
        REMOVE_FROM_SEARCH: true,
        REMOVE_FROM_RELATED: true,
        REMOVE_FROM_FEEDS: true,
        REMOVE_SIDEBAR_LINK: true,
        REDIRECT_SHORTS_PAGE: true,
        // --- Avanzado ---
        DEBOUNCE_DELAY_MS: 300,
        ENABLE_DEBUG_LOGGING: true,
        DEBUG_COLOR: '#2196F3', // Azul para v1.12
    };

    function log(...args) {
        if (config.ENABLE_DEBUG_LOGGING) {
            console.log('%c[ShortsRemover v1.12]', `color: ${config.DEBUG_COLOR}; font-weight: bold;`, ...args);
        }
    }
    function logDetail(...args) {
        if (config.ENABLE_DEBUG_LOGGING) {
             console.log('%c[ShortsRemover v1.12 Detail]', `color: ${config.DEBUG_COLOR};`, ...args);
        }
    }

    const patterns = {
        shortsPage: /^https?:\/\/(www\.)?youtube\.com\/shorts.*$/,
        searchPage: /^https?:\/\/(www\.)?youtube\.com\/results.*$/,
        watchPage: /^https?:\/\/(www\.)?youtube\.com\/watch\/?.*$/,
    };

    let removalDebounceTimeout = null;

    // --- Funciones Principales ---

    function runRemovals(source) {
        log(`Triggered by: ${source}. Scheduling removal check...`);
        clearTimeout(removalDebounceTimeout);
        removalDebounceTimeout = setTimeout(() => {
            const url = window.location.href;
            log(`Running removals on URL: ${url}`);

            try {
                if (config.REDIRECT_SHORTS_PAGE && patterns.shortsPage.test(url)) {
                    log("Redirecting from Shorts page...");
                    window.location.href = "https://www.youtube.com/";
                    return;
                }

                if (config.REMOVE_SIDEBAR_LINK) removeSidebarLink();

                if (config.REMOVE_FROM_SEARCH && patterns.searchPage.test(url)) {
                    // Eliminar grid-shelf por título (flexible)
                    removeSearchPageShortsGridShelf_v1_12(); // Usar la versión actualizada
                } else {
                    // Lógica general para otras páginas
                    removeGenericReelShelves();
                    removeShelfByTitleGeneral("Shorts"); // Podríamos hacer esta más flexible también si es necesario
                    removeShelfByTitleGeneral("Vídeos cortos");
                }

                if (shouldRemoveIndividualItems(url)) {
                    removeIndividualShortItems();
                }

                if (config.REMOVE_FROM_CHANNEL && url.match(/\/(channel|c|user|@)[^\/]+\/?(?!shorts)/)) {
                    removeChannelShortsTab();
                }

            } catch (error) {
                 console.error('[ShortsRemover v1.12] Error during removal process:', error);
            }

            log("Removal cycle finished.");

        }, config.DEBOUNCE_DELAY_MS);
    }

    function removeElement(element, reason) {
        if (element && element.isConnected) {
            log(`Removing ${element.tagName || 'element'} (Reason: ${reason})`, element);
            element.remove();
            return true;
        }
        return false;
    }

    // --- Funciones Auxiliares ---

    function removeSidebarLink() {
        const sidebarEntry = document.querySelector('ytd-guide-entry-renderer a[href="/shorts"]');
        if (sidebarEntry) {
            removeElement(sidebarEntry.closest('ytd-guide-entry-renderer'), 'Sidebar link');
        }
    }

    function removeGenericReelShelves() {
        const shelves = document.querySelectorAll('ytd-reel-shelf-renderer');
        shelves.forEach(shelf => removeElement(shelf, 'Generic ytd-reel-shelf-renderer'));
    }

    // *** Lógica para BÚSQUEDA: Usar includes() para el título ***
    function removeSearchPageShortsGridShelf_v1_12() {
        log("Running v1.12 search page grid-shelf removal logic (using includes)...");
        const titleSpans = document.querySelectorAll(
             'ytd-item-section-renderer grid-shelf-view-model h2.shelf-header-layout-wiz__title > span.yt-core-attributed-string, grid-shelf-view-model h2.shelf-header-layout-wiz__title > span.yt-core-attributed-string'
        );
        logDetail(`Found ${titleSpans.length} potential title spans matching the structure.`);

        titleSpans.forEach((span, index) => {
            const titleText = span.textContent.trim().toLowerCase();
            logDetail(`[TitleSpan ${index+1}/${titleSpans.length}] Text: "${titleText}"`);

            
            const isShortsTitle = titleText.includes('shorts') || titleText.includes('vídeos cortos');

            if (isShortsTitle) {
                logDetail(` -> Title contains keyword! Looking for parent 'grid-shelf-view-model'...`);
                const gridShelfToRemove = span.closest('grid-shelf-view-model');

                if (gridShelfToRemove) {
                    // Modificar la razón para reflejar la coincidencia flexible
                    const reason = `Search grid-shelf title containing "${titleText.includes('shorts') ? 'shorts' : 'vídeos cortos'}"`;
                    removeElement(gridShelfToRemove, reason);
                    // Considerar eliminar el padre ytd-item-section si deja hueco.
                    // const parentItemSection = gridShelfToRemove.closest('ytd-item-section-renderer');
                    // if (parentItemSection && parentItemSection.children.length === 1) { // Si solo contenía el grid-shelf
                    //    removeElement(parentItemSection, 'Parent item-section of removed grid-shelf');
                    // }

                } else {
                     logDetail(` -> !! Could not find parent 'grid-shelf-view-model' for this title span.`);
                }
            } else {
                logDetail(` -> Title does not contain keyword.`);
            }
        });
    }

    function removeShelfByTitleGeneral(shelfTitle) {
        const lowerCaseTitle = shelfTitle.toLowerCase();
        const shelfContainers = document.querySelectorAll(
            'ytd-rich-shelf-renderer, ytd-shelf-renderer'
        );
        shelfContainers.forEach(container => {
             const titleElement = container.querySelector(`#title, .title, yt-formatted-string.ytd-shelf-renderer`);
            if (titleElement && titleElement.textContent) {
                 const currentTitle = titleElement.textContent.trim().toLowerCase();
                 // Podríamos usar includes aquí también si aparecen variaciones en Home/Subs
                 if (currentTitle === lowerCaseTitle) {
                     removeElement(container, `General Shelf with title "${shelfTitle}"`);
                 }
            }
        });
    }

    function removeIndividualShortItems() {
        const potentialShorts = document.querySelectorAll(
             'ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer'
        );
        let count = 0;
        potentialShorts.forEach(item => {
            if (item.closest('ytd-reel-shelf-renderer')) return;
            const shortsOverlay = item.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]');
            const shortsLink = item.querySelector('a[href*="/shorts/"]');
            if (shortsOverlay || shortsLink) {
                if (removeElement(item, shortsOverlay ? 'Individual item with Shorts overlay' : `Individual item with link`)) count++;
            }
        });
         if (count > 0) log(`Removed ${count} individual backup items.`);
    }

     function shouldRemoveIndividualItems(url) {
        if (patterns.searchPage.test(url)) return false;
        if (config.REMOVE_FROM_HOME && url === 'https://www.youtube.com/') return true;
        if (config.REMOVE_FROM_SUBSCRIPTIONS && url.includes('/feed/subscriptions')) return true;
        if (config.REMOVE_FROM_RELATED && patterns.watchPage.test(url)) return true;
        if (config.REMOVE_FROM_FEEDS && url.includes('/feed/')) return true;
        return false;
    }

    function removeChannelShortsTab() {
        const tabs = document.querySelectorAll('tp-yt-paper-tab, .yt-tab-shape-wiz');
        tabs.forEach(tab => {
            const titleElement = tab.querySelector('.yt-tab-shape-checkout__tab-title-text, .yt-tab-shape-wiz__tab-title');
            if (titleElement && titleElement.textContent.trim().toLowerCase() === 'shorts') {
                removeElement(tab, 'Channel Shorts tab');
            }
        });
    }

    // --- Observador y Ejecución ---

    const observerOptions = { childList: true, subtree: true };
    let pageObserver = null;
    let currentHref = document.location.href;

    function observe() {
        log("Setting up MutationObserver on body.");
        pageObserver = new MutationObserver((mutations) => {
             if (currentHref !== document.location.href) {
                log(`URL changed: ${currentHref} -> ${document.location.href}`);
                currentHref = document.location.href;
                 runRemovals('URL Change');
             } else {
                 runRemovals('MutationObserver');
             }
        });
        pageObserver.observe(document.body, observerOptions);
    }

    function initialRun() {
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', () => {
                log("DOMContentLoaded fired. Starting observer and initial run.");
                currentHref = document.location.href;
                 if (!pageObserver) observe();
                runRemovals('Initial DOMContentLoaded');
            }, { once: true });
        } else {
            log("Body ready. Starting observer and initial run.");
            currentHref = document.location.href;
            if (!pageObserver) observe();
            runRemovals('Initial Script Run');
        }
    }

    log("ShortsRemover script initializing...");
    initialRun();

})();