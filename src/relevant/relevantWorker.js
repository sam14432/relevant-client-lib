/* eslint-disable */
require('../prebid');
import * as utils from '../utils';
import PostbidAuction from './postbidAuction';

class RelevantWorker
{
  constructor(preQueue, pbjs) {
    this.queue = preQueue || [];
    this.pbjs = pbjs;
  }

  init() {
    this.pbjs.setConfig({
      consentManagement: {},
      debug: ~location.toString().indexOf('relevant-debug'),
    });
    this.queue.forEach(param => this.runCmd(param));
  }

  runCmd(param) {
    const CMDS = {
      postbid: param => this.doPostbid(param),
      postbidPlacement: param => this.doPostbidPlacement(param),
    };
    try {
      if(utils.isFn(param)) {
        param(this);
      } else {
        if (!param || !CMDS[param.cmd]) {
          throw `Invalid parameter: ${(param || {}).cmd}`;
        }
        CMDS[param.cmd](param.param);
      }
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

  postbid(param) {
    const postbid = new PostbidAuction(this, param);
    postbid.run();
  }

  postbidPlacement(param) {

  }

  registerSiteConfig(param) {

  }

  push(param) {
    this.runCmd(param);
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
          const { loadedSitePaths = {} } = window.relevantQueue;
          window.relevantQueue = new RelevantWorker(window.relevantQueue, pbjs);
          window.relevantQueue.loadedSitePaths = {};
          window.relevantQueue.init();
        }
        return res;
      };
    })(window.pbjs, window.pbjs.processQueue);
  }
}

RelevantWorker.staticInit();
