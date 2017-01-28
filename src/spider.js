/**
 * Copyright (c) 2017 5u9ar (zhuyingda)
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
"use strict";
const request = require('request');
const output = require('../lib/out');

let crossSite = false;
let headers = {};
let hostPrefix = '';
let urlStack = [];
let jsStack = [];
let xhrStack = [];

function httpGet(url) {
    request({url: url, headers: headers}, (error, response, body) => {
        if (error == null) {
            let htmlContent = body;
            detectPath(htmlContent);
            detectJs(htmlContent);
        } else {
            output.err(error);
        }
    })
}

function httpGetJs(src) {
    request({url: src, headers: headers}, (error, response, body) => {
        if (error == null) {
            detectXhr(body);
        } else {
            output.err(error);
        }
    })
}

function detectPath(str) {
    let reg = /<a\b("[^"]*"|'[^']*'|[^'">])*>/g;
    str.replace(reg, (i) => {
        let reg2 = /href=["'].*?["']/g;
        i.replace(reg2, (ii) => {
            let url = ii.slice(6, ii.length - 1);
            output.log('发现路径:' + url);
            if (/^git/.test(url) || /^javascript/.test(url)) {
                //todo: 忽略除http以外的其他协议
                return;
            }
            if (/^http(s)?/.test(url) && crossSite) {
                output.log('发现外站路径:' + url);
                httpGet(url);
                return;
            }
            for (let j = 0; j < urlStack.length; j++) {
                if (urlStack[j] == url) {
                    //todo: 忽略已扫url
                    return;
                }
            }
            urlStack.push(url);
            if(!/^http(s)?/.test(url)){
                httpGet(hostPrefix + url);
            }
        })
    });
}

function detectJs(str) {
    let reg = /<script\b("[^"]*"|'[^']*'|[^'">])*>/g;
    str.replace(reg, (i) => {
        let reg2 = /src=["'].*?["']/g;
        i.replace(reg2, (ii) => {
            let src = ii.slice(5, ii.length - 1);
            for (let j = 0; j < jsStack.length; j++) {
                if (jsStack[j] == src) {
                    //todo: 忽略已扫src
                    return;
                }
            }
            if (/^http(s)?/.test(src)) {
                output.log('发现外站脚本:' + src);
                httpGetJs(src);
                jsStack.push(src);
            } else {
                output.log('发现站内脚本:' + src);
                httpGetJs(hostPrefix + src);
                jsStack.push(hostPrefix + src);
            }
        })
    });
}

function detectXhr(body) {
    let jsContent = body;
    if (/define\.amd\.jQuery/.test(jsContent)) {
        //todo: 发现jquery类库js
        return;
    }
    let reg = /["']\/\w*['"]/g;
    jsContent.replace(reg, (token) => {
        let xhr = token.slice(1, token.length - 1);
        if (xhr == '\/') {
            //todo: 忽略无意义的"/"
            return;
        }
        for (let j = 0; j < xhrStack.length; j++) {
            if (xhr == xhrStack[j]) {
                //todo: 忽略已扫xhr
                return;
            }
        }
        output.print('发现疑似ajax接口:' + xhr);
        xhrStack.push(xhr);
    });
}

function main(param) {
    console.time('共消耗时间');
    hostPrefix = 'http://' + param.host;
    crossSite = param.crossSite;
    headers = param.headers;
    if (param.log) {
        process.env.LOG = param.log;
    } else {
        process.env.LOG = 'none'
    }
    process.on('exit', (code) => {
        if (code == 0) {
            console.timeEnd('共消耗时间');
            output.print('共发现xhr地址:' + xhrStack.length + '个');
        } else {
            console.timeEnd('共消耗时间');
            output.err('异常结束，code:' + code);
        }
    });
    httpGet(hostPrefix);
}

module.exports = main