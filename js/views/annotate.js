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
 * A module representing the main view to create anotation
 * @module views-annotate
 * @requires jQuery
 * @requires underscore
 * @requires player-adapter
 * @requires models-annotation
 * @requires collections-annotations
 * @requires collections-categories
 * @requires templates/annotate-tab-title.tmpl
 * @requires ROLES
 * @requires ACCESS
 * @requires handlebars
 * @requires backbone
 */
define(["jquery",
        "underscore",
        "prototypes/player_adapter",
        "models/annotation",
        "collections/annotations",
        "collections/categories",
        "views/annotate-tab",
        "text!templates/annotate-tab-title.tmpl",
        "roles",
        "access",
        "handlebars",
        "backbone"],

    function ($, _, PlayerAdapter, Annotation, Annotations, Categories, AnnotateTab, TabTitleTemplate, ROLES, ACCESS, Handlebars, Backbone) {

        "use strict";

        /**
         * Prefix for the name of the categories tab id
         * @type {String}
         */
        var TAB_LINK_PREFIX = "#labelTab-",

            /**
             * List of default tabs, each object contains an id, name and an array of roles
             * @type {Object}
             */
            DEFAULT_TABS = {
                ALL: {
                    id   : "all",
                    name : "All",
                    roles: []
                },
                PUBLIC: {
                    id        : "public",
                    name      : "Public",
                    filter    : {isPublic: true},
                    roles     : [ROLES.SUPERVISOR],
                    attributes: {access: ACCESS.PUBLIC}
                },
                MINE: {
                    id        : "mine",
                    name      : "Mine",
                    filter    : {isPublic: false},
                    roles     : [ROLES.SUPERVISOR, ROLES.USER],
                    attributes: {access: ACCESS.PRIVATE}
                }
            },

            /**
             * @constructor
             * @see {@link http://www.backbonejs.org/#View}
             * @memberOf module:views-annotate
             * @augments module:Backbone.View
             * @alias module:views-annotate.Annotate
             */
            Annotate = Backbone.View.extend({

                /**
                 * Main container of the timeline
                 * @alias module:views-timeline.TimelineView#el
                 * @type {DOM Element}
                 */
                el: $("div#annotate-container"),


                /**
                 * Events to handle by the annotate view
                 * @alias module:views-annotate.Annotate#events
                 * @type {map}
                 */
                events: {
                    "keyup #new-annotation"             : "keydownOnAnnotate",
                    "click #insert"                     : "insert",
                    "click #annotate-full"              : "setLayoutFull",
                    "click #annotate-text"              : "setLayoutText",
                    "click #annotate-categories"        : "setLayoutCategories",
                    "click .toggle-collapse"            : "toggleVisibility",
                    "keydown #new-annotation"           : "onFocusIn",
                    "focusout #new-annotation"          : "onFocusOut",
                    "click #label-tabs-buttons a"       : "showTab",
                    "click #editSwitch"                 : "onSwitchEditModus"
                },

                /**
                 * Template for tabs button
                 * @alias module:views-annotate.Category#tabsButtonTemplate
                 * @type {Handlebars template}
                 */
                tabsButtonTemplate: Handlebars.compile(TabTitleTemplate),

                /**
                 * Element containing the tabs buttons
                 * @alias module:views-annotate.Category#tabsButtonsElement
                 * @type {DOM Element}
                 */
                tabsButtonsElement: $("ul#label-tabs-buttons"),

                /**
                 * Element containing the tabs contents
                 * @alias module:views-annotate.Category#tabsContainerElement
                 * @type {DOM Element}
                 */
                tabsContainerElement: $("div#label-tabs-contents"),

                /**
                 * Define if the view is or not in edit modus.
                 * @alias module:views-annotate.Category#editModus
                 * @type {boolean}
                 */
                editModus: false,

                /**
                 * Map with all the category tabs
                 * @alias module:views-annotate.Category#categoriesTabs
                 * @type {map}
                 */
                categoriesTabs: {},

                /**
                 * The default tabs when switching in edit modus
                 * @alias module:views-annotate.Category#DEFAULT_TAB_ON_EDIT
                 * @type {map}
                 */
                DEFAULT_TAB_ON_EDIT: DEFAULT_TABS.MINE.id,

                /**
                 * constructor
                 * @alias module:views-annotate.Category#initialize
                 * @param {PlainObject} attr Object literal containing the view initialization attributes.
                 */
                initialize: function (attr) {
                    var categories;

                    // Set the current context for all these functions
                    _.bindAll(this,
                              "insert",
                              "reset",
                              "onFocusIn",
                              "onFocusOut",
                              "changeTrack",
                              "addTab",
                              "onSwitchEditModus",
                              "checkToContinueVideo",
                              "switchEditModus",
                              "keydownOnAnnotate",
                              "setLayoutCategories",
                              "setLayoutText",
                              "setLayoutFull",
                              "toggleVisibility");

                    // Parameter for stop on write
                    this.continueVideo = false;

                    // New annotation input
                    this.input = this.$("#new-annotation");

                    // Print selected track
                    this.trackDIV = this.$el.find("div.currentTrack span.content");
                    this.changeTrack(annotationsTool.selectedTrack);

                    this.tracks = annotationsTool.video.get("tracks");
                    this.tracks.bind("selected_track", this.changeTrack, this);
                    this.playerAdapter = attr.playerAdapter;

                    if (annotationsTool.isStructuredAnnotationEnabled()) {
                        categories = annotationsTool.video.get("categories");

                        _.each(DEFAULT_TABS, function (params) {
                            this.addTab(categories, params);
                        }, this);
                    } else {
                        this.$el.find("#categories").hide();
                        this.$el.find("#annotate-categories").parent().hide();
                    }

                    if (!annotationsTool.isFreeTextEnabled()) {
                        this.$el.find("#input-container").hide();
                        this.$el.find("#annotate-text").parent().hide();
                    }

                    this.$el.find("#annotate-full").addClass("checked");

                    this.tabsContainerElement.find("div.tab-pane:first-child").addClass("active");
                    this.tabsButtonsElement.find("a:first-child").parent().first().addClass("active");

                    // Add backbone events to the model
                    _.extend(this, Backbone.Events);
                },

                /**
                 * Proxy function for insert through 'enter' keypress
                 * @alias module:views-annotate.Annotate#keydownOnAnnotate
                 * @param {event} event Event object
                 */
                keydownOnAnnotate: function (e) {
                    // If enter is pressed and shit not, we insert a new annotation
                    if (e.keyCode === 13 && !e.shiftKey) {
                        this.insert();
                    }
                },

                /**
                 * Insert a new annotation
                 * @alias module:views-annotate.Annotate#insert
                 * @param {event} event Event object
                 */
                insert: function (event) {
                    if (event) {
                        event.stopImmediatePropagation();
                    }

                    var value = this.input.val(),
                        time = Math.round(this.playerAdapter.getCurrentTime()),
                        options = {},
                        params,
                        annotation;

                    if (!value || (!_.isNumber(time) || time < 0)) {
                        return;
                    }

                    params = {
                        text: value,
                        start: time
                    };

                    if (annotationsTool.user) {
                        params.created_by = annotationsTool.user.id;
                    }

                    if (!annotationsTool.localStorage) {
                        options.wait = true;
                    }

                    annotation = annotationsTool.selectedTrack.get("annotations").create(params, options);

                    if (this.continueVideo) {
                        annotationsTool.playerAdapter.play();
                    }

                    this.input.val("");
                    this.input.focus();
                },

                /**
                 * Change the current selected track by the given one
                 * @alias module:views-annotate.Annotate#changeTrack
                 * @param {Track} track The new track
                 */
                changeTrack: function (track) {
                    // If the track is valid, we set it
                    if (track) {
                        this.input.attr("disabled", false);
                        this.trackDIV.html(track.get("name"));
                    } else {
                        // Otherwise, we disable the input and inform the user that no track is set
                        this.input.attr("disabled", true);
                        this.trackDIV.html("<span class='notrack'>Select a track!</span>");
                    }
                },

                /**
                 * Listener for when a user start to write a new annotation,
                 * manage if the video has to be or not paused.
                 * @alias module:views-annotate.Annotate#onFocusIn
                 */
                onFocusIn: function () {
                    if (!this.$el.find("#pause-video").attr("checked") || (annotationsTool.playerAdapter.getStatus() === PlayerAdapter.STATUS.PAUSED)) {
                        return;
                    }

                    this.continueVideo = true;
                    this.playerAdapter.pause();

                    // If the video is moved, or played, we do no continue the video after insertion
                    $(annotationsTool.playerAdapter).one(PlayerAdapter.EVENTS.TIMEUPDATE, function () {
                        this.continueVideo = false;
                    });
                },

                /**
                 * Listener for when we leave the annotation input
                 * @alias module:views-annotate.Annotate#onFocusOut
                 */
                onFocusOut: function () {
                    setTimeout(this.checkToContinueVideo, 200);
                },

                /**
                 * Check if the video must continue, and if yes, continue to play it
                 * @alias module:views-annotate.Annotate#checkToContinueVideo
                 */
                checkToContinueVideo: function () {
                    if ((annotationsTool.playerAdapter.getStatus() === PlayerAdapter.STATUS.PAUSED) && this.continueVideo) {
                        this.continueVideo = false;
                        this.playerAdapter.play();
                    }
                },

                /**
                 * Show the tab related to the source from the event
                 * @alias module:views-annotate.Annotate#showTab
                 * @param {Event} event Event object
                 */
                showTab: function (event) {
                    var tabId = event.currentTarget.attributes.getNamedItem("href").value;

                    tabId = tabId.replace(TAB_LINK_PREFIX, "");

                    $(event.currentTarget).one("shown", $.proxy(function () {
                        this.categoriesTabs[tabId].initCarousel();
                    }, this));

                    $(event.currentTarget).tab("show");
                },

                /**
                 * Add a new categories tab in the annotate view
                 * @alias module:views-annotate.Annotate#addTab
                 * @param {Categories} categories Categories to add to the new tab
                 * @param {object} attr Infos about the new tab like id, name, filter for categories and roles.
                 */
                addTab: function (categories, attr) {
                    var params = {
                            id        : attr.id,
                            name      : attr.name,
                            categories: categories,
                            filter    : attr.filter,
                            roles     : attr.roles,
                            attributes: attr.attributes
                        },
                        newButton = this.tabsButtonTemplate(params),
                        annotateTab;

                    newButton = $(newButton).appendTo(this.tabsButtonsElement);
                    params.button = newButton;

                    annotateTab = new AnnotateTab(params);

                    this.categoriesTabs[attr.id] = annotateTab;
                    this.tabsContainerElement.append(annotateTab.$el);
                },

                /**
                 * Listener for edit modus switch.
                 * @alias module:views-annotate.Annotate#onSwitchEditModus
                 * @param {Event} event Event related to this action
                 */
                onSwitchEditModus: function (event) {
                    var status = $(event.target).attr("checked") === "checked";

                    this.switchEditModus(status);

                    if (status) {
                        this.showTab({
                            currentTarget: this.categoriesTabs[this.DEFAULT_TAB_ON_EDIT].titleLink.find("a")[0]
                        });
                    }
                },

                /**
                 * Switch the edit modus to the given status.
                 * @alias module:views-annotate.Annotate#switchEditModus
                 * @param  {boolean} status The current status
                 */
                switchEditModus: function (status) {
                    this.editModus = status;

                    this.$el.toggleClass("edit-on", status);

                    // trigger an event that all element switch in edit modus
                    annotationsTool.trigger(annotationsTool.EVENTS.ANNOTATE_TOGGLE_EDIT, status);
                },

                /**
                 * Change the layout to full layout, with all possiblities to annotate
                 * @alias module:views-annotate.Annotate#setLayoutFull
                 * @param {Event} event Event object
                 */
                setLayoutFull: function (event) {
                    if (!$(event.target).hasClass("checked")) {
                        if (annotationsTool.isStructuredAnnotationEnabled()) {
                            this.$el.find("#categories").show();
                        }
                        if (annotationsTool.isFreeTextEnabled()) {
                            this.$el.find("#input-container").show();
                        }
                        this.$el.find("#annotate-text").removeClass("checked");
                        this.$el.find("#annotate-categories").removeClass("checked");
                        $(event.target).addClass("checked");
                        this.trigger("change-layout");
                    }
                },

                /**
                 * Set layout for free text annotation only
                 * @alias module:views-annotate.Annotate#setLayoutText
                 * @param {Event} event Event object
                 */
                setLayoutText: function (event) {
                    if (!$(event.target).hasClass("checked")) {
                        this.$el.find("#categories").hide();
                        this.$el.find("#input-container").show();
                        this.$el.find("#annotate-full").removeClass("checked");
                        this.$el.find("#annotate-categories").removeClass("checked");
                        $(event.target).addClass("checked");
                        this.trigger("change-layout");
                    }
                },

                /**
                 * Set layout for labels annotation only
                 * @alias module:views-annotate.Annotate#setLayoutCategories
                 * @param {Event} event Event object
                 */
                setLayoutCategories: function (event) {
                    if (!$(event.target).hasClass("checked")) {
                        this.$el.find("#categories").show();
                        this.$el.find("#input-container").hide();
                        this.$el.find("#annotate-text").removeClass("checked");
                        this.$el.find("#annotate-full").removeClass("checked");
                        $(event.target).addClass("checked");
                        this.trigger("change-layout");
                    }
                },

                /**
                 * Toggle the visibility of the annotate part
                 * @alias module:views-annotate.Annotate#toggleVisibility
                 * @param {Event} event Event object
                 */
                toggleVisibility: function (event) {
                    var mainContainer = this.$el.find(".control-group");

                    if (mainContainer.css("display") === "none") {
                        mainContainer.show();
                        $("div#annotate-container").toggleClass("expanded");
                        $(event.target).html("Collapse");
                    } else {
                        mainContainer.hide();
                        $("div#annotate-container").toggleClass("expanded");
                        $(event.target).html("Expand");
                    }
                    this.trigger("change-layout");
                },

                /**
                 * Reset the view
                 * @alias module:views-annotate.Annotate#reset
                 */
                reset: function () {
                    this.$el.hide();
                    delete this.tracks;
                    this.undelegateEvents();

                    if (annotationsTool.isStructuredAnnotationEnabled()) {
                        this.tabsContainerElement.empty();
                        this.$el.find("#editSwitch input").attr("checked", false);
                        this.tabsButtonsElement.find(".tab-button").remove();
                    }
                }
            });
        return Annotate;
    }
);