/* eslint-disable */
require('../prebid');
import * as utils from '../utils';
import find from 'core-js/library/fn/array/find';
import PostbidAuction from './postbidAuction';
import SmartAdserver from './smartAdserver';
import DfpAdserver from './dfpAdserver';

class RelevantWorker
{
  constructor(preQueue, pbjs) {
    this.queue = preQueue || [];
    this.pbjs = pbjs;
    this.adservers = [];
    this.pendingAuctions = [];
    try {
      this.pageConfig = top.RELEVANT_POSTBID_CONFIG || {};
    } catch(e) {
      this.pageConfig = {};
    }
    this.logToConsole = ~location.toString().indexOf('relevant-console');
    this.prebidDebug = ~location.toString().indexOf('relevant-debug');
  }

  init() {
    this.pbjs.setConfig({
      consentManagement: {},
      debug: this.prebidDebug,
      rubicon: {
        singleRequest: true,
      }
    });
    this.queue.forEach(param => this.runCmd(param));
    this.runPendingAuctions();
  }

  event(type, params) {
    const { pageConfig } = this;
    if (pageConfig.type) {
      pageConfig.type(params);
    }
  }

  runCmd(param) {
    const CMDS = {
      postbid: param => this.doPostbid(param),
    };
    try {
      if(!param || !CMDS[param.cmd]) {
        throw `Invalid parameter: ${(param || {}).cmd}`;
      }
      CMDS[param.cmd](param.param);
    } catch(e) {
      utils.logError(`Command error: ${e.message}`);
      if(param.onError) {
        try {
          param.onError(e);
        } catch(e) {
          utils.logError(`Error in error handler: ${e.message}`);
        }
      }
    }
  }

  doPostbid(param) {
    const postbid = new PostbidAuction(this, param);
    postbid.init();
    this.pendingAuctions.push(postbid);
  }

  runPendingAuctions() {
    const auctions = this.pendingAuctions;
    this.pendingAuctions = [];
    PostbidAuction.requestMultipleBids(auctions);
  }

  getAdserver(type) {
    let Type;
    if(type === 'smart') {
      Type = SmartAdserver;
    } else {
      Type = DfpAdserver;
    }
    if(!Type) {
      throw Error(`No adserver type '${type}'`);
    }
    let adserver = find(this.adservers, ads => ads instanceof Type);
    if (!adserver) {
      adserver = new Type();
      this.adservers.push(adserver);
    }
    return adserver;
  }

  push(param) {
    this.runCmd(param);
    this.runPendingAuctions();
  }

  static staticInit() {
    ((pbjs, orgQueueFn) => {
      if (!pbjs || !orgQueueFn) {
        throw Error('window.pbjs must exist at this stage');
      }
      let initialized;
      pbjs.processQueue = function(...args) {
        const res = orgQueueFn.call(this, ...args);
        if(!initialized) {
          initialized = true;
          window.relevantQueue = new RelevantWorker(window.relevantQueue, pbjs);
          window.relevantQueue.init();
        }
        return res;
      };
    })(window.pbjs, window.pbjs.processQueue);
  }
}

RelevantWorker.staticInit();
