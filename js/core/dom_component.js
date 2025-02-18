import $ from '../core/renderer';
import config from './config';
import errors from './errors';
import windowResizeCallbacks from '../core/utils/resize_callbacks';
import { Component } from './component';
import { TemplateManager } from './template_manager';
import { attachInstanceToElement, getInstanceByElement } from './utils/public_component';
import { cleanDataRecursive } from './element_data';
import { each } from './utils/iterator';
import { extend } from './utils/extend';
import { getPublicElement } from '../core/element';
import { grep, noop } from './utils/common';
import { isString, isDefined, isFunction } from './utils/type';
import { hasWindow } from '../core/utils/window';
import { resize as resizeEvent, visibility as visibilityEvents } from '../events/short';

const { abstract } = Component;

const DOMComponent = Component.inherit({
    _getDefaultOptions() {
        return extend(this.callBase(), {

            width: undefined,

            height: undefined,

            rtlEnabled: config().rtlEnabled,

            elementAttr: {},

            disabled: false,

            integrationOptions: {}
        }, this._useTemplates() ? TemplateManager.createDefaultOptions() : {});
    },
    /**
    * @name DOMComponent.ctor
    * @publicName ctor(element,options)
    * @param1 element:Element|JQuery
    * @param2 options:DOMComponentOptions|undefined
    * @hidden
    */
    ctor(element, options) {
        this._customClass = null;

        this._createElement(element);
        attachInstanceToElement(this._$element, this, this._dispose);

        this.callBase(options);
    },

    _createElement(element) {
        this._$element = $(element);
    },

    _getSynchronizableOptionsForCreateComponent() {
        return ['rtlEnabled', 'disabled', 'templatesRenderAsynchronously'];
    },

    _checkFunctionValueDeprecation: function(optionNames) {
        if(!this.option('_ignoreFunctionValueDeprecation')) {
            optionNames.forEach(optionName => {
                if(isFunction(this.option(optionName))) {
                    errors.log('W0017', optionName);
                }
            });
        }
    },

    _visibilityChanged: abstract,
    _dimensionChanged: abstract,

    _init() {
        this.callBase();
        this._checkFunctionValueDeprecation([
            'width', 'height',
            'maxHeight', 'maxWidth',
            'minHeight', 'minWidth',
            'popupHeight', 'popupWidth'
        ]);
        this._attachWindowResizeCallback();
        this._initTemplateManager();
    },

    _setOptionsByDevice(instanceCustomRules) {
        this.callBase([].concat(this.constructor._classCustomRules || [], instanceCustomRules || []));
    },

    _isInitialOptionValue(name) {
        const isCustomOption = this.constructor._classCustomRules
            && Object.prototype.hasOwnProperty.call(this._convertRulesToOptions(this.constructor._classCustomRules), name);

        return !isCustomOption && this.callBase(name);
    },

    _attachWindowResizeCallback() {
        if(this._isDimensionChangeSupported()) {
            const windowResizeCallBack = this._windowResizeCallBack = this._dimensionChanged.bind(this);

            windowResizeCallbacks.add(windowResizeCallBack);
        }
    },

    _isDimensionChangeSupported() {
        return this._dimensionChanged !== abstract;
    },

    _renderComponent() {
        this._initMarkup();

        hasWindow() && this._render();
    },

    _initMarkup() {
        const { rtlEnabled } = this.option() || {};

        this._renderElementAttributes();
        this._toggleRTLDirection(rtlEnabled);
        this._renderVisibilityChange();
        this._renderDimensions();
    },

    _render() {
        this._attachVisibilityChangeHandlers();
    },

    _renderElementAttributes() {
        const { elementAttr } = this.option() || {};
        const attributes = extend({}, elementAttr);
        const classNames = attributes.class;

        delete attributes.class;

        this.$element()
            .attr(attributes)
            .removeClass(this._customClass)
            .addClass(classNames);

        this._customClass = classNames;
    },

    _renderVisibilityChange() {
        if(this._isDimensionChangeSupported()) {
            this._attachDimensionChangeHandlers();
        }

        if(this._isVisibilityChangeSupported()) {
            const $element = this.$element();

            $element.addClass('dx-visibility-change-handler');
        }
    },

    _renderDimensions() {
        const $element = this.$element();
        const element = $element.get(0);
        const width = this._getOptionValue('width', element);
        const height = this._getOptionValue('height', element);

        if(this._isCssUpdateRequired(element, height, width)) {
            $element.css({
                width: width === null ? '' : width,
                height: height === null ? '' : height
            });
        }
    },

    _isCssUpdateRequired(element, height, width) {
        return !!(isDefined(width) || isDefined(height) || element.style.width || element.style.height);
    },

    _attachDimensionChangeHandlers() {
        const $el = this.$element();
        const namespace = `${this.NAME}VisibilityChange`;

        resizeEvent.off($el, { namespace });
        resizeEvent.on($el, () => this._dimensionChanged(), { namespace });
    },

    _attachVisibilityChangeHandlers() {
        if(this._isVisibilityChangeSupported()) {
            const $el = this.$element();
            const namespace = `${this.NAME}VisibilityChange`;

            this._isHidden = !this._isVisible();
            visibilityEvents.off($el, { namespace });
            visibilityEvents.on($el,
                () => this._checkVisibilityChanged('shown'),
                () => this._checkVisibilityChanged('hiding'),
                { namespace }
            );
        }
    },

    _isVisible() {
        const $element = this.$element();

        return $element.is(':visible');
    },

    _checkVisibilityChanged(action) {
        const isVisible = this._isVisible();

        if(isVisible) {
            if(action === 'hiding' && !this._isHidden) {
                this._visibilityChanged(false);
                this._isHidden = true;
            } else if(action === 'shown' && this._isHidden) {
                this._isHidden = false;
                this._visibilityChanged(true);
            }
        }
    },

    _isVisibilityChangeSupported() {
        return this._visibilityChanged !== abstract && hasWindow();
    },

    _clean: noop,

    _modelByElement() {
        const { modelByElement } = this.option();
        const $element = this.$element();

        return modelByElement ? modelByElement($element) : undefined;
    },

    _invalidate() {
        if(this._isUpdateAllowed()) {
            throw errors.Error('E0007');
        }

        this._requireRefresh = true;
    },

    _refresh() {
        this._clean();
        this._renderComponent();
    },

    _dispose() {
        this._templateManager && this._templateManager.dispose();
        this.callBase();
        this._clean();
        this._detachWindowResizeCallback();
    },

    _detachWindowResizeCallback() {
        if(this._isDimensionChangeSupported()) {
            windowResizeCallbacks.remove(this._windowResizeCallBack);
        }
    },

    _toggleRTLDirection(rtl) {
        const $element = this.$element();

        $element.toggleClass('dx-rtl', rtl);
    },

    _createComponent(element, component, config = {}) {
        const synchronizableOptions = grep(
            this._getSynchronizableOptionsForCreateComponent(),
            value => !(value in config)
        );

        const { integrationOptions } = this.option();
        let { nestedComponentOptions } = this.option();

        nestedComponentOptions = nestedComponentOptions || noop;

        const nestedComponentConfig = extend(
            { integrationOptions },
            nestedComponentOptions(this)
        );

        synchronizableOptions.forEach(optionName =>
            nestedComponentConfig[optionName] = this.option(optionName)
        );

        this._extendConfig(config, nestedComponentConfig);

        let instance = void 0;

        if(isString(component)) {
            const $element = $(element)[component](config);

            instance = $element[component]('instance');
        } else if(element) {
            instance = component.getInstance(element);

            if(instance) {
                instance.option(config);
            } else {
                instance = new component(element, config);
            }
        }

        if(instance) {
            const optionChangedHandler = ({ name, value }) => {
                if(synchronizableOptions.includes(name)) {
                    instance.option(name, value);
                }
            };

            this.on('optionChanged', optionChangedHandler);
            instance.on('disposing', () => this.off('optionChanged', optionChangedHandler));
        }

        return instance;
    },

    _extendConfig(config, extendConfig) {
        each(extendConfig, (key, value) => {
            !Object.prototype.hasOwnProperty.call(config, key) && (config[key] = value);
        });
    },

    _defaultActionConfig() {
        const $element = this.$element();
        const context = this._modelByElement($element);

        return extend(this.callBase(), { context });
    },

    _defaultActionArgs() {
        const $element = this.$element();
        const model = this._modelByElement($element);
        const element = this.element();

        return extend(this.callBase(), { element, model });
    },

    _optionChanged(args) {
        switch(args.name) {
            case 'width':
            case 'height':
                this._renderDimensions();
                break;
            case 'rtlEnabled':
                this._invalidate();
                break;
            case 'elementAttr':
                this._renderElementAttributes();
                break;
            case 'disabled':
            case 'integrationOptions':
                break;
            default:
                this.callBase(args);
                break;
        }
    },

    _removeAttributes(element) {
        const attrs = element.attributes;

        for(let i = attrs.length - 1; i >= 0; i--) {
            const attr = attrs[i];

            if(attr) {
                const { name } = attr;

                if(!name.indexOf('aria-') || name.indexOf('dx-') !== -1 ||
                    name === 'role' || name === 'style' || name === 'tabindex') {
                    element.removeAttribute(name);
                }
            }
        }
    },

    _removeClasses(element) {
        element.className = element.className
            .split(' ')
            .filter(cssClass => cssClass.lastIndexOf('dx-', 0) !== 0)
            .join(' ');
    },

    _updateDOMComponent(renderRequired) {
        if(renderRequired) {
            this._renderComponent();
        } else if(this._requireRefresh) {
            this._requireRefresh = false;
            this._refresh();
        }
    },

    endUpdate() {
        const renderRequired = this._isInitializingRequired();

        this.callBase();
        this._isUpdateAllowed() && this._updateDOMComponent(renderRequired);
    },

    $element() {
        return this._$element;
    },

    element() {
        const $element = this.$element();

        return getPublicElement($element);
    },

    dispose() {
        const element = this.$element().get(0);

        cleanDataRecursive(element, true);
        element.textContent = '';
        this._removeAttributes(element);
        this._removeClasses(element);
    },

    resetOption(optionName) {
        this.callBase(optionName);

        if(optionName === 'width' || optionName === 'height') {
            const initialOption = this.initialOption(optionName);

            !isDefined(initialOption) && this.$element().css(optionName, '');
        }
    },

    _getAnonymousTemplateName() {
        return void 0;
    },

    _initTemplateManager() {
        if(this._templateManager || !this._useTemplates()) return void 0;

        const { integrationOptions = {} } = this.option();
        const { createTemplate } = integrationOptions;

        this._templateManager = new TemplateManager(
            createTemplate,
            this._getAnonymousTemplateName()
        );
        this._initTemplates();
    },

    _initTemplates() {
        const { templates, anonymousTemplateMeta } = this._templateManager.extractTemplates(this.$element());
        const anonymousTemplate = this.option(`integrationOptions.templates.${anonymousTemplateMeta.name}`);

        templates.forEach(({ name, template }) => {
            this._options.silent(`integrationOptions.templates.${name}`, template);
        });

        if(anonymousTemplateMeta.name && !anonymousTemplate) {
            this._options.silent(`integrationOptions.templates.${anonymousTemplateMeta.name}`, anonymousTemplateMeta.template);
            this._options.silent('_hasAnonymousTemplateContent', true);
        }
    },

    _getTemplateByOption(optionName) {
        return this._getTemplate(this.option(optionName));
    },

    _getTemplate(templateSource) {
        const templates = this.option('integrationOptions.templates');
        const isAsyncTemplate = this.option('templatesRenderAsynchronously');
        const skipTemplates = this.option('integrationOptions.skipTemplates');

        return this._templateManager.getTemplate(
            templateSource,
            templates,
            {
                isAsyncTemplate,
                skipTemplates
            },
            this
        );
    },

    _saveTemplate(name, template) {
        this._setOptionWithoutOptionChange(
            'integrationOptions.templates.' + name,
            this._templateManager._createTemplate(template)
        );
    },

    _useTemplates() {
        return true;
    },
});

DOMComponent.getInstance = function(element) {
    return getInstanceByElement($(element), this);
};

DOMComponent.defaultOptions = function(rule) {
    this._classCustomRules = this._classCustomRules || [];
    this._classCustomRules.push(rule);
};

export default DOMComponent;
