#Author-Autodesk Inc.
#Description-Apply an appearance to selected faces, bodies or occurrences.

import adsk.core, adsk.fusion, traceback

app = None
ui  = None
commandId = 'ApplyAppearanceToSelectionCommand'
commandName = 'ApplyAppearanceToSelection'
commandDescription = 'Apply an appearance to selected bodies or occurrences'

# global set of event handlers to keep them referenced for the duration of the command
handlers = []
appearancesMap = {}
        
def clearAllItems(cmdInput):
    cmdInput.listItems.add('None', True, '')
    while cmdInput.listItems.count > 1:
        if cmdInput.listItems[0].name != 'None':
            cmdInput.listItems[0].deleteMe()
        else:
            cmdInput.listItems[1].deleteMe()
            
def replaceItems(cmdInput, newItems):
    clearAllItems(cmdInput)
    if len(newItems) > 0:
        for item in newItems:
            cmdInput.listItems.add(item, False, '')
        cmdInput.listItems[1].isSelected = True
        cmdInput.listItems[0].deleteMe()

def getAppearance(appearanceName):
    materialLibs = app.materialLibraries
    appearance = None
    for materialLib in materialLibs:
        appearances = materialLib.appearances

        try:
            appearance = appearances.itemByName(appearanceName)
        except:
            pass
        
        if appearance:
            break
    return appearance
    
def getMaterialLibNames():
    materialLibs = app.materialLibraries
    libNames = []
    for materialLib in materialLibs:
        libNames.append(materialLib.name)
    return libNames
    
def getAppearancesFromLib(libName, filterExp):
    global appearancesMap
    appearanceList = None
    if libName in appearancesMap:
        appearanceList = appearancesMap[libName]
    else:
        materialLib = app.materialLibraries.itemByName(libName)
        appearances = materialLib.appearances
        appearanceNames = []
        for appearance in appearances:
            appearanceNames.append(appearance.name)
        appearancesMap[libName] = appearanceNames
        appearanceList = appearanceNames
    if filterExp and len(filterExp) > 0:
        filteredList = []
        for appearanceName in appearanceList:
            if appearanceName.lower().find(filterExp.lower()) >= 0:
                filteredList.append(appearanceName)
        return filteredList
    else:
        return appearanceList
    
def getSelectedObjects(selectionInput):
    objects = []
    for i in range(0, selectionInput.selectionCount):
        selection = selectionInput.selection(i)
        selectedObj = selection.entity
        if adsk.fusion.BRepBody.cast(selectedObj) or \
           adsk.fusion.BRepFace.cast(selectedObj) or \
           adsk.fusion.Occurrence.cast(selectedObj):
           objects.append(selectedObj)
    return objects

def applyAppearanceToObjects(appearance, objects):
    for obj in objects:
        obj.appearance = appearance
        
class ApplyAppearanceInputChangedHandler(adsk.core.InputChangedEventHandler):
    def __init__(self):
        super().__init__()
    def notify(self, args):
        try:
            cmd = args.firingEvent.sender
            inputs = cmd.commandInputs
            appearanceListInput = None
            materialLibInput = None
            filterInput = None
            global commandId
            for inputI in inputs:
                if inputI.id == commandId + '_appearanceList':
                    appearanceListInput = inputI
                elif inputI.id == commandId + '_materialLib':
                    materialLibInput = inputI
                elif inputI.id == commandId + '_filter':
                    filterInput = inputI
            cmdInput = args.input
            if cmdInput.id == commandId + '_materialLib' or cmdInput.id == commandId + '_filter':
                appearances = getAppearancesFromLib(materialLibInput.selectedItem.name, filterInput.value)
                replaceItems(appearanceListInput, appearances)
        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

class ApplyAppearanceExecuteHandler(adsk.core.CommandEventHandler):
    def __init__(self):
        super().__init__()
    def notify(self, args):
        try:
            cmd = args.firingEvent.sender
            inputs = cmd.commandInputs
            selectionInput = None
            appearanceListInput = None
            for inputI in inputs:
                global commandId
                if inputI.id == commandId + '_selection':
                    selectionInput = inputI
                elif inputI.id == commandId + '_appearanceList':
                    appearanceListInput = inputI
           
            objects = getSelectedObjects(selectionInput)

            if not objects or len(objects) == 0:
                return
            
            appearance = getAppearance(appearanceListInput.selectedItem.name)
            if not appearance:
                return

            applyAppearanceToObjects(appearance, objects)
        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

class ApplyAppearanceDestroyHandler(adsk.core.CommandEventHandler):
    def __init__(self):
        super().__init__()
    def notify(self, args):
        try:
            # when the command is done, terminate the script
            # this will release all globals which will remove all event handlers
            adsk.terminate()
        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

class ApplyAppearanceCreatedHandler(adsk.core.CommandCreatedEventHandler):    
    def __init__(self):
        super().__init__()        
    def notify(self, args):
        try:
            cmd = args.command
            onExecute = ApplyAppearanceExecuteHandler()
            cmd.execute.add(onExecute)
            
            onDestroy = ApplyAppearanceDestroyHandler()
            cmd.destroy.add(onDestroy)
            onInputChanged = ApplyAppearanceInputChangedHandler()
            cmd.inputChanged.add(onInputChanged)
            # keep the handler referenced beyond this function
            handlers.append(onExecute)
            handlers.append(onDestroy)
            handlers.append(onInputChanged)
            inputs = cmd.commandInputs
            global commandId
            selectionInput = inputs.addSelectionInput(commandId + '_selection', 'Select', 'Select bodies or occurrences')
            selectionInput.setSelectionLimits(1)
            materialLibInput = inputs.addDropDownCommandInput(commandId + '_materialLib', 'Material Library', adsk.core.DropDownStyles.LabeledIconDropDownStyle)
            listItems = materialLibInput.listItems
            materialLibNames = getMaterialLibNames()
            for materialName in materialLibNames:
                listItems.add(materialName, False, '')
            listItems[0].isSelected = True
            appearanceListInput = inputs.addDropDownCommandInput(commandId + '_appearanceList', 'Appearance', adsk.core.DropDownStyles.TextListDropDownStyle)
            appearances = getAppearancesFromLib(materialLibNames[0], '')
            listItems = appearanceListInput.listItems
            for appearanceName in appearances:
                listItems.add(appearanceName, False, '')
            listItems[0].isSelected = True
            inputs.addStringValueInput(commandId + '_filter', 'Filter', '')
        except:
            if ui:
                ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

def main():
    try:
        global app
        app = adsk.core.Application.get()
        global ui
        ui = app.userInterface

        global commandId
        global commandName
        global commandDescription
        
        cmdDef = ui.commandDefinitions.itemById(commandId)
        if not cmdDef:
            cmdDef = ui.commandDefinitions.addButtonDefinition(commandId, commandName, commandDescription) # no resource folder is specified, the default one will be used

        onCommandCreated = ApplyAppearanceCreatedHandler()
        cmdDef.commandCreated.add(onCommandCreated)
        # keep the handler referenced beyond this function
        handlers.append(onCommandCreated)

        inputs = adsk.core.NamedValues.create()
        cmdDef.execute(inputs)

        # prevent this module from being terminate when the script returns, because we are waiting for event handlers to fire
        adsk.autoTerminate(False)

    except:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

main()
