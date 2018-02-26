import xml2js from '@mol/vast-xml2js';
import {
  getWrapperOptions,
  getFirstAd,
  getVASTAdTagURI,
  hasAdPod,
  isInline,
  isWrapper
} from '@mol/vast-selectors';
import fetch from './helpers/fetch';
import {markAdAsRequested} from './helpers/adUtils';

const validateChain = (vastChain, {wrapperLimit = 5}) => {
  if (vastChain.length > wrapperLimit) {
    const error = new Error('Wrapper Limit reached');

    error.errorCode = 304;
    throw error;
  }
};

const fetchAdXML = async (adTag, options) => {
  try {
    const response = await fetch(adTag, options);
    const XML = await response.text();

    return XML;
  } catch (error) {
    error.errorCode = 502;

    throw error;
  }
};

const parseVASTXML = (xml) => {
  try {
    return xml2js(xml);
  } catch (error) {
    error.errorCode = 100;
    throw error;
  }
};

const getAd = (parsedXML) => {
  try {
    const ad = getFirstAd(parsedXML);

    if (Boolean(ad)) {
      markAdAsRequested(ad);

      return ad;
    }

    throw new Error('No Ad');
  } catch (error) {
    error.errorCode = 303;
    throw error;
  }
};

const validateResponse = ({ad, parsedXML}, {allowMultipleAds = true, followAdditionalWrappers = true}) => {
  if (!isWrapper(ad) && !isInline(ad)) {
    const error = new Error('Invalid VAST, ad contains neither Wrapper nor Inline');

    error.errorCode = 101;
    throw error;
  }

  if (hasAdPod(parsedXML) && !allowMultipleAds) {
    const error = new Error('Multiple ads are not allowed');

    error.errorCode = 203;
    throw error;
  }

  if (isWrapper(ad) && !followAdditionalWrappers) {
    const error = new Error('To follow additional wrappers is not allowed');

    error.errorCode = 200;
    throw error;
  }
};

const getOptions = (vastChain, options) => {
  const parentAd = vastChain[0];
  const parentAdIsWrapper = Boolean(parentAd) && isWrapper(parentAd.ad);
  const wrapperOptions = parentAdIsWrapper ? getWrapperOptions(parentAd.ad) : {};

  return Object.assign({}, wrapperOptions, options);
};

/**
 * A Object representing a processed VAST response.
 *
 * @typedef {Object} VASTResponse
 * @property {Object} ad - The selected ad extracted from the pasedXML.
 * @property {Object} parsedXML - The XML parsed object.
 * @property {number} errorCode - VAST error code number to idenitfy the error or null if there is no error.
 * @property {Error} error - Error instance with a human readable description of the error or undefined if there is no error.
 * @property {string} requestTag - Ad tag that was used to get this `VastResponse`.
 * @property {string} XML - RAW XML as it came from the server.
 */

/**
 * Array of VASTResponses sorted backguards. Last response goes first.
 * Represents the chain of VAST responses that ended up on a playable video ad or an error.
 *
 * @typedef {Array.VASTAdResponse} VASTChain
 * @property {Object} ad - The selected ad extracted from the pasedXML.
 * @property {Object} parsedXML - The XML parsed object.
 * @property {number} errorCode - VAST error code number to idenitfy the error or null if there is no error.
 * @property {Error} error - Error instance with a human readable description of the error or undefined if there is no error.
 * @property {string} requestTag - Ad tag that was used to get this `VastResponse`.
 * @property {string} XML - RAW XML as it came from the server.
 */

/**
 * Request the ad using the passed ad tag and returns an array with the VAST responses needed to get an inline ad.
 *
 * @param {string} adTag - The VAST ad tag request url.
 * @param {Object} options - Options Map. The allowed properties area:
 *                           * `wrapperLimit` which sets the maximum number of wrappers allowed in the vastChain.
 *                              Defaults to 5.
 *                           * `AllowMultipleAds` Boolean to indicate whether adPods are allowed or not.
 *                              Defaults to true.
 * @param {VASTChain} [vastChain] - Optional vastChain with the previous VAST responses.
 * @returns Promise<VASTChain> - Returns a Promise that will resolve a VastChain with the newest VAST response at the begining of the array.
 *                    If the VastChain had an error. The first VAST response of the array will contain an error and an errorCode entry.
 * @static
 */
const requestAd = async (adTag, options = {}, vastChain = []) => {
  const VASTAdResponse = {
    ad: null,
    errorCode: null,
    parsedXML: null,
    requestTag: adTag,
    XML: null
  };

  try {
    const opts = getOptions(vastChain, options);

    validateChain(vastChain, opts);

    VASTAdResponse.XML = await fetchAdXML(adTag, options);
    VASTAdResponse.parsedXML = parseVASTXML(VASTAdResponse.XML);
    VASTAdResponse.ad = getAd(VASTAdResponse.parsedXML);

    validateResponse(VASTAdResponse, opts);

    if (isWrapper(VASTAdResponse.ad)) {
      return requestAd(getVASTAdTagURI(VASTAdResponse.ad), opts, [VASTAdResponse, ...vastChain]);
    }

    return [VASTAdResponse, ...vastChain];
  } catch (error) {
    if (!Number.isInteger(error.errorCode)) {
      error.errorCode = 900;
    }

    VASTAdResponse.errorCode = error.errorCode;
    VASTAdResponse.error = error;

    return [VASTAdResponse, ...vastChain];
  }
};

export default requestAd;
