//Author-Autodesk Inc.
//Description-Apply an appearance to selected faces, bodies or occurrences.
/*globals adsk*/
(function () {

    "use strict";
    var commandId = 'ApplyAppearanceToSelectionCommand';
    var commandName = 'ApplyAppearanceToSelection';
    var commandDescription = 'Apply an appearance to selected bodies or occurrences';
    
    var app = adsk.core.Application.get(), ui;
    var appearancesMap = {};
    
    if (app) {
        ui = app.userInterface;
    }
    
    var errorDescription = function(e) {
        return (e.description ? e.description : e);
    };
    
    var clearAllItems = function(cmdInput) {
        cmdInput.listItems.add('None', true);
        while(cmdInput.listItems.count > 1) {
            if (cmdInput.listItems.item(0).name != 'None') {
                cmdInput.listItems.item(0).deleteMe();
            } else {
                cmdInput.listItems.item(1).deleteMe();
            }
        }
    };
    
    var replaceItems = function(cmdInput, newItems) {
        clearAllItems(cmdInput);
        if (newItems.length > 0) {
            for (var x = 0; x < newItems.length; ++x) {
                cmdInput.listItems.add(newItems[x], false);
            }
            cmdInput.listItems.item(1).isSelected = true;
            cmdInput.listItems.item(0).deleteMe();
        }
    };
    
    var getAppearance = function(appearanceName) {
        var materialLibs = app.materialLibraries;
        var appearance;
        for (var x = 0; x < materialLibs.count; ++x) {
            var materialLib = materialLibs.item(x);
            var appearances = materialLib.appearances;
            try {
                appearance = appearances.itemByName(appearanceName);
            } catch (e) {
                console.log(errorDescription(e));
            }
            if (appearance) {
                break;
            }
        }
            
        return appearance;
    };
    
    var getMaterialLibNames = function() {
        var materialLibs = app.materialLibraries;
        var libNames = [];
        for (var x = 0; x < materialLibs.count; ++x) {
            libNames.push(materialLibs.item(x).name);
        }
        return libNames;
    };
    
    var getAppearancesFromLib = function(libName, filterExp) {
        var appearanceList;
        if (appearancesMap[libName]) {
            appearanceList = appearancesMap[libName];
        } else {
            var materialLib = app.materialLibraries.itemByName(libName);
            var appearances = materialLib.appearances;
            var appearanceNames = [];
            for (var x = 0; x < appearances.count; ++x) {
                appearanceNames.push(appearances.item(x).name);
            }
            appearancesMap[libName] = appearanceNames;
            appearanceList = appearanceNames;
        }
        if (filterExp && filterExp.length > 0) {
            var filteredList = [];
            for (var i = 0; i < appearanceList.length; ++i) {
                var appearanceName = appearanceList[i];
                if (appearanceName.toLowerCase().indexOf(filterExp.toLowerCase()) >= 0) {
                    filteredList.push(appearanceName);
                }
            }
            return filteredList;
        } else {
            return appearanceList;
        }
    };
    
    var getSelectedObjects = function(selectionInput) {
        var objects = [];
        for (var i = 0; i < selectionInput.selectionCount; ++i) {
            var selection = selectionInput.selection(i);
            var selectedObj = selection.entity;
            if ('adsk::fusion::BRepBody' == selectedObj.objectType ||
                'adsk::fusion::Occurrence' == selectedObj.objectType ||
                'adsk::fusion::BRepFace' == selectedObj.objectType) {
                objects.push(selectedObj);
            }
        }
        
        return objects;
    };
    
    var applyAppearanceToBodies = function(appearance, objects) {
        for (var x = 0; x < objects.length; ++x) {
            var entity = objects[x];
            entity.appearance = appearance;
        }
    };
    
    var createCommandDefinition = function() {
        var commandDefinitions = ui.commandDefinitions;
        
        // Check if the command is already added
        var cmDef = commandDefinitions.itemById(commandId);
        if (!cmDef) {
            cmDef = commandDefinitions.addButtonDefinition(commandId, 
                    commandName, 
                    commandDescription); // no resource folder is specified, the default one will be used
        }
        return cmDef;
    };
    
    var onInputChanged = function(args) {
        try
        {
            var command = adsk.core.Command(args.firingEvent.sender);
            var inputs = command.commandInputs;
            var appearanceListInput, materialLibInput, filterInput;
            for (var x = 0; x < inputs.count; ++x) {
                var input = inputs.item(x);
                if (input.id == commandId + '_appearanceList') {
                    appearanceListInput = input;
                } else if (input.id == commandId + '_materialLib') {
                    materialLibInput = input;
                } else if (input.id == commandId + '_filter') {
                    filterInput = input;
                }
            }
            var changedInput = args.input;
            if (changedInput.id == commandId + '_materialLib' ||
               changedInput.id == commandId + '_filter') {
                var appearances = getAppearancesFromLib(materialLibInput.selectedItem.name, filterInput.value);
                replaceItems(appearanceListInput, appearances);
            }
        } catch (e) {
            ui.messageBox('input change failed: ' + errorDescription(e));
        }
    };
    
    var onCommandExecuted = function(args) {
        try {
            var command = adsk.core.Command(args.firingEvent.sender);
            var inputs = command.commandInputs;
            var selectionInput, appearanceListInput;
            for (var x = 0; x < inputs.count; ++x) {
                var input = inputs.item(x);
                if (input.id == commandId + '_selection') {
                    selectionInput = input;
                } else if (input.id == commandId + '_appearanceList') {
                    appearanceListInput = input;
                }
            }
            
            var objects = getSelectedObjects(selectionInput);
            if  (!objects || objects.length === 0) {
                return;
            }
            
            var appearance = getAppearance(appearanceListInput.selectedItem.name);
            if (!appearance) {
                return;
            }

            applyAppearanceToBodies(appearance, objects);
        } catch (e) {
            ui.messageBox('command executed failed: ' + errorDescription(e));
        }
    };
    
    var onCommandCreated = function(args) {
        try {
            var command = args.command;
            command.execute.add(onCommandExecuted);
            command.inputChanged.add(onInputChanged);

            // Terminate the script when the command is destroyed
            command.destroy.add(function () { adsk.terminate(); });

            var inputs = command.commandInputs;
            var selectionInput = inputs.addSelectionInput(commandId + '_selection', 'Select', 'Select bodies or occurrences');
            selectionInput.setSelectionLimits(1);
            var materialLibInput = inputs.addDropDownCommandInput(commandId + '_materialLib', 'Material Library', adsk.core.DropDownStyles.LabeledIconDropDownStyle);
            var listItems = materialLibInput.listItems;
            var materialLibNames = getMaterialLibNames();
            for (var x = 0; x < materialLibNames.length; ++x) {
                listItems.add(materialLibNames[x], false);
            }
            listItems.item(0).isSelected = true;
            var appearanceListInput = inputs.addDropDownCommandInput(commandId + '_appearanceList', 'Appearance', adsk.core.DropDownStyles.TextListDropDownStyle);
            var appearances = getAppearancesFromLib(materialLibNames[0], '');
            listItems = appearanceListInput.listItems;
            for (var i = 0; i < appearances.length; ++i) {
                listItems.add(appearances[i], false);
            }
            listItems.item(0).isSelected = true;
            inputs.addStringValueInput(commandId + '_filter', 'Filter');
        } catch (e) {
            ui.messageBox('command created failed: ' + errorDescription(e));
        }
    };
    
    try {
        if (adsk.debug === true) {
            /*jslint debug: true*/
            debugger;
            /*jslint debug: false*/
        }

        var command = createCommandDefinition();
        var commandCreatedEvent = command.commandCreated;
        commandCreatedEvent.add(onCommandCreated);
        command.execute();
    } catch (e) {
        ui.messageBox('Failed: ' + errorDescription(e));
        adsk.terminate();
    }
}());