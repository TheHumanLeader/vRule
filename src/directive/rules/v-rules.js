//规则校验
window.VRule = {
    /**
     * 校验
     * @param $this  vue 实例 this
     * @param group  分组
     * @returns {boolean}
     */
    valid($this, group) {
        if (!$this) throw 'function VRule.create($this,group) , $this 不能为空';
        const {_uid} = $this;
        if (!_uid && _uid !== 0) throw 'function VRule.create($this,group) , $this 必须为 Vue 实例';
        const groupEx = group && group.trim().length;
        const groupKey = `${_uid}${groupEx ? ':' : ''}${groupEx ? group : ''}`;
        let store = window.VRule.store[groupKey];
        if (!store) return true;
        let error = false;
        for (let el of store.list) {
            if (el.rules && el.rules.length) {
                let ruleRes = checkRules(el.rules, getValue(el.vnode));
                if (ruleRes) {
                    el.error(ruleRes);
                    error = true;
                }
            }
        }
        if (error) {
            $this.$warn('请检验参数');
        }
        return !error;
    },
    /**
     * 创建并获取存储<br>
     * 已存在，则直接返回
     * @param $this  vue 实例 this
     * @param group  分组
     * @returns {*}
     */
    create($this, group) {
        if (!$this) throw 'function VRule.create($this,group) , $this 不能为空';
        const groupEx = group && group.trim().length;
        const {_uid} = $this;
        if (!_uid && _uid !== 0) throw 'function VRule.create($this,group) , $this 必须为 Vue 实例';
        const groupKey = `${_uid}${groupEx ? ':' : ''}${groupEx ? group : ''}`;
        if (!window.VRule.store[groupKey])
            window.VRule.store[groupKey] = {
                list: [],
            };
        return window.VRule.store[groupKey];
    },
    store: {},
    createTimeDuration: 300,
    defaultErrorClass: []
};
/**
 * 全局 不重复 key 生成器
 * @type {function(): number}
 */
window.$Key = function () {
    let counter = 0;

    function getAndIncrement() {
        let i = counter + 1;
        while (i - 1 != counter) {
            i = counter + 1;
        }
        return counter = i;
    }

    return getAndIncrement;
}();
const defaultStringHandler = function (handler, data) {
    data = data ? data : '';
    handler = handler.toLowerCase();
    let arr = handler.split(':');
    let arrSize = arr.length;
    handler = arr[0];
    switch (handler) {
        case 'notnull':
            if (!data || !data.trim())
                return `${arrSize > 1 ? arr[1] : '该内容'}不能为空`;
            break;
        case 'min':
            let min;
            if (arrSize > 2)
                min = Number(arr[2]);
            if (data && data.length < min)
                return `${arr.length > 1 ? arr[1] : '该内容'}至少为${min}个字符`;
            break;
        case 'max':
            let max;
            if (arrSize > 2)
                max = Number(arr[2]);
            if (data && data.length > max)
                return `${arr.length > 1 ? arr[1] : '该内容'}最多为${max}个字符`;
            break;
    }
    return false;
}
const checkRules = function (rules, value) {
    let ruleRes;
    for (let rule of rules) {
        let ruleType = typeof rule;
        if (ruleType === "string") {
            ruleRes = defaultStringHandler(rule, value);
        } else if (ruleType === 'function') {
            ruleRes = rule(value);
        }
        if (ruleRes !== true) break;
    }
    return ruleRes === true ? false : ruleRes;
}

function getValue(vnode) {
    if (!vnode.data) return null;
    let {model, attrs} = vnode.data;

    if (attrs['rules-value'] || attrs['rulesValue']) {
        return attrs['rules-value'];
    } else if (model) {
        return model.value;
    } else {
        throw ' v-rules 需要绑定参数，参数默认为 v-model 及 rules-value(rulesValue) ，例：<input v-model="value"/> 或 <input :rules-value="value"/>'
    }
}

function getErrorClass(vnode) {
    if (!vnode.data) return null;
    let {attrs} = vnode.data;

    let errorClass;
    if (errorClass = attrs['errorClass']) return errorClass;
    if (errorClass = attrs['error-class']) return errorClass;

    return;
}

const vRules = {
    inserted(el, binding, vnode) {
        const {arg, value} = binding;
        let store = VRule.create(vnode.context, arg);
        let ex = false;
        for (let i = 0; i < store.list.length; i++) {
            if (el === store.list[i]) {
                ex = true;
                return;
            }
        }
        if (!ex) {
            el.pkId = $Key();
            el.rules = value;
            el.vnode = vnode;
            store.list.push(el);
        }

        let input = $deep(el, 'children', (item) => {
            let {tagName} = item;
            if (tagName.toLowerCase() === 'input') {
                return item;
            }
        });

        el.watchInput = input;
        el.createTime = new Date().getTime();
        el.error = function (msg, vnode) {
            if (!el.errorMsg) {
                let rootNode = el.watchInput.parentElement;
                let append = document.createElement("div");
                append.innerHTML = `<span>${msg}</span>`;

                append.className = 'input-error-msg hae-meta';
                rootNode.style.position = 'relative';
                rootNode.style.borderColor = 'red';
                el.watchInput.style.borderColor = 'red';
                rootNode.appendChild(append);
                el.errorMsg = append;
                let errorClass;
                if (errorClass = getErrorClass(vnode))
                    el.classList = [
                        ...el.classList,
                        ...VRule.defaultErrorClass,
                        errorClass
                    ]
            } else {
                el.errorMsg.innerText = msg;
            }
        }
        el.unError = function () {
            if (el.errorMsg) {
                el.removeChild(el.errorMsg);
                el.errorMsg = null;
            }
            input.style.borderColor = '';
        }

    },
    update(el, binding, vnode) {
        //创建后 300ms 内的重复触发，不执行
        if (new Date().getTime() - el.createTime < VRule.createTimeDuration) return;

        const {arg} = binding;
        el.vnode = vnode;
        let value = getValue(vnode);
        let ruleRes = checkRules(el.rules, value);
        let pass = !ruleRes;
        if (!pass) {
            let store = VRule.create(vnode.context, arg);
            store.lastErrorMsg = ruleRes;
            el.error(ruleRes, vnode);
        } else {
            el.unError();
        }
    },
    unbind(el, binding, vnode) {
        const {arg, value} = binding;
        let store = VRule.create(vnode.context, arg);
        for (let i = 0; i < store.list.length; i++) {
            if (el === store.list[i]) {
                store.list.splice(i, 1);
                return;
            }
        }

    }
}
const install = function (Vue) {
    const style = document.createElement('style');
    style.type = `text/css`;
    style.innerHTML =
        ".input-error-msg.hae-meta{\n" +
        "  position: absolute;\n" +
        "  bottom: -16px;\n" +
        "  left: 0px;\n" +
        "  width: 100%;\n" +
        "  white-space: nowrap;\n" +
        "  overflow: hidden;\n" +
        "  text-overflow: ellipsis;\n" +
        "  color: red;\n" +
        "  z-index: 2;\n" +
        "  font-size: 12px;\n" +
        "}\n" +
        ".input-error-msg.hae-meta>span{\n" +
        "  transform: scale(0.9);" +
        "}\n" +
        "[rules] td .cell {" +
        "  overflow: unset;" +
        "}";
    document.getElementsByTagName(`head`).item(0).appendChild(style);
    Vue.directive('rules', vRules);
    Vue.prototype.$Key = window.$Key;
};
export default install;
