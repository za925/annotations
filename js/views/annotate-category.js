/**
 *  Copyright 2012, Entwine GmbH, Switzerland
 *  Licensed under the Educational Community License, Version 2.0
 *  (the "License"); you may not use this file except in compliance
 *  with the License. You may obtain a copy of the License at
 *
 *  http://www.osedu.org/licenses/ECL-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an "AS IS"
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 *
 */

/**
 * A module representing the category view in the annotate part
 * @module views-annotate-category
 * @requires jQuery
 * @requires views-annotate-label
 * @requires templates/annotate-category.tmpl
 * @requires handlebars
 * @requires jquery.colorPicker
 * @requires backbone
 */
define(["jquery",
        "views/annotate-label",
        "text!templates/annotate-category.tmpl",
        "handlebars",
        "jquery.colorPicker",
        "backbone"],


    function ($, LabelView, Template, Handlebars) {

        "use strict";

        /**
         * @constructor
         * @see {@link http://www.backbonejs.org/#View}
         * @memberOf module:views-annotate-category
         * @augments module:Backbone.View
         * @alias module:views-annotate-category.CategoryView
         */
        var CategoryView = Backbone.View.extend({

            /**
             * Tag name from the view element
             * @alias module:views-annotate-category.Category#tagName
             * @type {string}
             */
            tagName: "div",

            /**
             * Class name from the view element
             * @alias module:views-annotate-category.Category#className
             * @type {string}
             */
            className: "span1 category-item",

            /**
             * Prefix for the item id
             * @alias module:views-annotate-category.Category#ID_PREFIX
             * @type {string}
             */
            ID_PREFIX: "catItem-",

            /**
             * Define if the view has been or not deleted
             * @alias module:views-annotate-category.Category#deleted
             * @type {boolean}
             */
            deleted: false,

            /**
             * Define if the view is or not in edit modus.
             * @alias module:views-annotate-category.Category#editModus
             * @type {boolean}
             */
            editModus: false,

            /**
             * View template
             * @alias module:views-annotate-category.Category#template
             * @type {Handlebars template}
             */
            template: Handlebars.compile(Template),

            /**
             * Events to handle by the annotate-category view
             * @alias module:views-annotate-category.CategoryView#events
             * @type {map}
             */
            events: {
                "click .catItem-header i.delete"   : "onDeleteCategory",
                "click .catItem-header i.scale"    : "editScale",
                "focusout .catItem-header input"   : "onFocusOut",
                "keydown .catItem-header input"    : "onKeyDown",
                "click   .catItem-add"             : "onCreateLabel"
            },

            /**
             * Constructor
             * @alias module:views-annotate-category.CategoryView#initialize
             * @param {PlainObject} attr Object literal containing the view initialization attributes.
             */
            initialize: function (attr) {
                var labels;

                if (!attr.category || !_.isObject(attr.category)) {
                    throw "Category object must be given as constuctor attribute!";
                }

                // Set the current context for all these functions
                _.bindAll(this,
                  "onDeleteCategory",
                  "deleteView",
                  "addLabels",
                  "addLabel",
                  "render",
                  "switchEditModus",
                  "onSwitchEditModus",
                  "onChange",
                  "onFocusOut",
                  "onKeyDown",
                  "onColorChange",
                  "removeOne",
                  "onCreateLabel",
                  "editScale");


                // Define the colors (global setting for all color pickers)
                $.fn.colorPicker.defaults.colors = ["ffff99",
                                                  "ffd800",
                                                  "ffcc99",
                                                  "ffa800",
                                                  "ff7800",
                                                  "c36e00",
                                                  "d5d602",
                                                  "d9be6c",
                                                  "ff99cc",
                                                  "ff5d7c",
                                                  "da0000",
                                                  "d15c49",
                                                  "969601",
                                                  "adfded",
                                                  "8fc7c7",
                                                  "a4d2ff",
                                                  "00ccff",
                                                  "64b0e8",
                                                  "61ae24",
                                                  "9ded0a",
                                                  "92ffaa",
                                                  "c0adfd",
                                                  "ac5bff",
                                                  "6569ff"];

                // Type use for delete operation
                this.typeForDelete = annotationsTool.deleteOperation.targetTypes.CATEGORY;
                this.roles = attr.roles;
                this.labelViews = [];

                if (attr.editModus) {
                    this.editModus = attr.editModus;
                }

                this.el.id = this.ID_PREFIX + attr.category.get("id");
                this.model = attr.category;

                this.addLabels(this.model.get("labels"));

                labels = this.model.get("labels");
                this.listenTo(labels, "add", this.addLabel);
                this.listenTo(labels, "remove", this.removeOne);
                this.listenTo(labels, "destroy", this.removeOne);
                this.listenTo(this.model, "change", this.onChange);

                if (_.contains(this.roles, annotationsTool.user.get("role"))) {
                    this.listenTo(annotationsTool.video, "switchEditModus", this.onSwitchEditModus);
                }

                this.render();
                this.nameInput = this.$el.find(".catItem-header input");
                return this;
            },

            /**
             * Listener for edit modus switch.
             * @alias module:views-annotate-category.CategoryView#onSwitchEditModus
             * @param {boolean} status The new status
             */
            onSwitchEditModus: function (status) {
                this.switchEditModus(status);
            },

            /**
             * Listener for the "change" event from the view model (Category)
             * @alias module:views-annotate-category.CategoryView#onChange
             */
            onChange: function () {
                _.each(this.labelViews, function (labelView) {
                    labelView.changeCategory(this.model.toJSON());
                }, this);
                this.render();
            },

            /**
             * Switch the edit modus to the given status.
             * @alias module:views-annotate-category.CategoryView#switchEditModus
             * @param  {boolean} status The current status
             */
            switchEditModus: function (status) {
                this.editModus = status;

                if (status) {
                    this.$el.find("input[disabled=\"disabled\"]").removeAttr("disabled");
                } else {
                    this.$el.find("input").attr("disabled", "disabled");
                }
            },

            /**
             * Open the scales editor modal
             * @alias module:views-annotate-category.CategoryView#editScale
             */
            editScale: function () {
                annotationsTool.scaleEditor.show(this.model, this.model.get("access"));
            },

            /**
             * Listener for category deletion request from UI
             * @alias module:views-annotate-category.CategoryView#onDeleteCategory
             * @param  {Event} event
             */
            onDeleteCategory: function () {
                annotationsTool.deleteOperation.start(this.model, this.typeForDelete);
            },

            /**
             * Delete only this category view
             * @alias module:views-annotate-category.CategoryView#deleteView
             */
            deleteView: function () {
                this.remove();
                this.undelegateEvents();
                this.deleted = true;
            },

            /**
             * Add a collection of labels to this view
             * @alias module:views-annotate-category.CategoryView#addLabels
             * @param {Labels} labels Collection of label to add
             */
            addLabels: function (labels) {
                labels.each(function (label) {
                    this.addLabel(label, false);
                }, this);
            },

            /**
             * Add one label to this view
             * @alias module:views-annotate-category.CategoryView#addLabel
             * @param {Label} label  The label to add
             * @param {boolean} single Define if this is part of a list insertion (false) or a single insertion (true)
             */
            addLabel: function (label, single) {
                var labelView = new LabelView({
                    label        : label,
                    editModus    : this.editModus,
                    roles        : this.roles,
                    isScaleEnable: this.model.get("settings").hasScale
                });

                this.labelViews.push(labelView);

                // If unique label added, we redraw all the category view
                if (single) {
                    this.render();
                }
            },

            /**
             * Create a new label in the category of this view
             * @alias module:views-annotate-category.CategoryView#onCreateLabel
             */
            onCreateLabel: function () {
                var label = this.model.get("labels").create({
                    value       : "LB",
                    abbreviation: "New",
                    category    : this.model
                },
                  {wait: true}
                );

                label.save();
                this.model.save();

                if (annotationsTool.localStorage) {
                    annotationsTool.video.save();
                }
            },

            /**
             * Remove the given category from the views list
             * @alias module:views-annotate-category.CategoryView#removeOne
             * @param {Category} Category from which the view has to be deleted
             */
            removeOne: function (delLabel) {
                _.find(this.labelViews, function (labelView, index) {
                        if (delLabel === labelView.model) {
                            labelView.remove();
                            this.labelViews.splice(index, 1);
                            return;
                        }
                    }, this);
            },

            /**
             * Listener for focus out event on name field
             * @alias module:views-annotate-category.CategoryView#onFocusOut
             */
            onFocusOut: function () {
                this.model.set("name", _.escape(this.nameInput.val()), {silent: true});
                this.model.save();
            },

            /**
             * Listener for key down event on name field
             * @alias module:views-annotate-category.CategoryView#onKeyDown
             */
            onKeyDown: function (e) {
                if (e.keyCode === 13) { // If "return" key
                    this.model.set("name", _.escape(this.nameInput.val()));
                    this.model.save();
                } else if (e.keyCode === 39 && this.getCaretPosition(e.target) === e.target.value.length ||
                           e.keyCode === 37 && this.getCaretPosition(e.target) === 0) {
                    // Avoid scrolling through arrows keys
                    e.preventDefault();
                }
            },

            /**
             * Get the position of the caret in the given input element
             * @alias module:views-annotate-category.CategoryView#getCaretPosition
             * @param  {DOM Element} inputElement The given element with focus
             * @return {integer}              The posisiton of the carret
             */
            getCaretPosition: function (inputElement) {
                var CaretPos = 0,
                    Sel;

                // IE Support
                if (document.selection) {
                    inputElement.focus();
                    Sel = document.selection.createRange();

                    Sel.moveStart("character", -inputElement.value.length);

                    CaretPos = Sel.text.length;
                } else if (inputElement.selectionStart || inputElement.selectionStart == "0") {
                    // Firefox support
                    CaretPos = inputElement.selectionStart;
                }

                return (CaretPos);
            },

            /**
             * Listener for color selection through color picker
             * @alias module:views-annotate-category.CategoryView#onColorChange
             * @param  {string} id       Id of the colorpicker element
             * @param  {string} newValue Value of the selected color
             */
            onColorChange: function (id, newValue) {
                this.model.setColor(newValue);
                this.model.save();
            },

            /**
             * Draw the view
             * @alias module:views-annotate-category.CategoryView#render
             * @return {CategoryView} this category view
             */
            render: function () {
                var modelJSON = this.model.toJSON();
                modelJSON.notEdit = !this.editModus;

                this.$el.html(this.template(modelJSON));

                _.each(this.labelViews, function (view) {
                    this.$el.find(".catItem-labels").append(view.render().$el);
                }, this);

                this.nameInput = this.$el.find(".catItem-header input");

                this.$el.find(".colorpicker").colorPicker({
                    pickerDefault: this.model.attributes.settings.color.replace("#", ""),
                    onColorChange: this.onColorChange
                });
                this.$el.find(".colorPicker-picker").addClass("edit");
                this.delegateEvents(this.events);
                return this;
            }
        });
        return CategoryView;
    }
);