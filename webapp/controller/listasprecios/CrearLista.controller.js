sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    const BASE_URL = window.BASE_URL || 'http://localhost:3033/api';

    return Controller.extend("com.invertions.sapfiorimodinv.controller.listasprecios.CrearLista", {

        onInit: function () {
            const oUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");
            
            const oWizardModel = new JSONModel({
                DESLISTA: "",
                IDINSTITUTOOK: "",
                IDTIPOLISTAOK: "",
                IDTIPOGENERALISTAOK: "ESPECIFICA",
                IDTIPOFORMULAOK: "FIJO",
                FECHAEXPIRAINI: this._formatDateForInput(new Date()),
                FECHAEXPIRAFIN: this._formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
                RANGO_PRECIOS: "",
                REGUSER: oUser?.USERNAME || "SYSTEM",
                selectedProducts: [],
                selectedProductsCount: 0,
                filteredProducts: [],
                allProducts: [],
                availableMarcas: [],
                allCategories: [],
                selectedMarcas: [],
                selectedCategories: [],
                searchTerm: "",
                activeFilterCount: 0,
                currentStep: 1,
                canProceed: false,
                loading: false,
                isEditing: false,
                editingListaId: null
            });
            
            this.getView().setModel(oWizardModel, "wizardModel");
            
            // Cargar productos
            this._loadProducts();
            
            // Detectar ruta para saber si es crear o editar
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteCrearLista").attachPatternMatched(this._onCrearListaRoute, this);
            oRouter.getRoute("RouteEditarLista").attachPatternMatched(this._onEditarListaRoute, this);
        },
        
        _onCrearListaRoute: function () {
            console.log("📝 Navegando a CREAR LISTA");
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/isEditing", false);
            oModel.setProperty("/editingListaId", null);
            // Reset del formulario
            oModel.setProperty("/DESLISTA", "");
            oModel.setProperty("/IDINSTITUTOOK", "");
            oModel.setProperty("/IDTIPOLISTAOK", "");
            oModel.setProperty("/selectedProducts", []);
            oModel.setProperty("/selectedProductsCount", 0);
            oModel.setProperty("/currentStep", 1);
        },
        
        _onEditarListaRoute: function (oEvent) {
            console.log("✏️ Navegando a EDITAR LISTA");
            const oArgs = oEvent.getParameter("arguments");
            const sListaId = oArgs?.listaId;
            
            if (sListaId) {
                const oModel = this.getView().getModel("wizardModel");
                oModel.setProperty("/isEditing", true);
                oModel.setProperty("/editingListaId", sListaId);
                this._loadListaForEditing(sListaId);
            }
        },
        
        _loadListaForEditing: async function (sListaId) {
            try {
                console.log("📦 Cargando lista para editar:", sListaId);
                const aListas = await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, { ProcessType: 'GetAll' });
                
                const oLista = aListas.find(l => l.IDLISTAOK === sListaId);
                if (!oLista) {
                    MessageBox.error("No se encontró la lista seleccionada.");
                    return;
                }
                
                const oModel = this.getView().getModel("wizardModel");
                oModel.setProperty("/DESLISTA", oLista.DESLISTA || "");
                oModel.setProperty("/IDINSTITUTOOK", oLista.IDINSTITUTOOK || "");
                oModel.setProperty("/IDTIPOLISTAOK", oLista.IDTIPOLISTAOK || "");
                oModel.setProperty("/IDTIPOGENERALISTAOK", oLista.IDTIPOGENERALISTAOK || "ESPECIFICA");
                oModel.setProperty("/IDTIPOFORMULAOK", oLista.IDTIPOFORMULAOK || "FIJO");
                oModel.setProperty("/FECHAEXPIRAINI", this._formatDateForInput(new Date(oLista.FECHAEXPIRAINI)));
                oModel.setProperty("/FECHAEXPIRAFIN", this._formatDateForInput(new Date(oLista.FECHAEXPIRAFIN)));
                
                // Marcar los SKUs que están en la lista
                if (oLista.SKUSIDS && Array.isArray(oLista.SKUSIDS)) {
                    const aAllProducts = oModel.getProperty("/allProducts") || [];
                    const aSelectedProducts = aAllProducts.filter(p => oLista.SKUSIDS.includes(p.SKUID));
                    oModel.setProperty("/selectedProducts", aSelectedProducts);
                    oModel.setProperty("/selectedProductsCount", aSelectedProducts.length);
                }
                
                oModel.setProperty("/currentStep", 1);
                MessageToast.show("Datos cargados para edición");
                
            } catch (error) {
                console.error("❌ Error al cargar lista para editar:", error);
                MessageBox.error("Error al cargar la lista: " + error.message);
            }
        },

        onNavBack: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteListasPrecios", {}, true);
        },

        _loadProducts: async function () {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/loading", true);
            
            try {
                console.log("🚀 Iniciando carga de productos...");
                console.log("🔗 BASE_URL:", BASE_URL);
                
                const response = await this._callApi('/ztproducts/crudProducts', 'POST', {}, { 
                    ProcessType: 'GetAll' 
                });
                
                console.log("📦 Respuesta recibida (tipo):", typeof response);
                console.log("📦 Respuesta recibida (es array?):", Array.isArray(response));
                console.log("📦 Respuesta completa:", response);
                
                // La respuesta puede venir en diferentes estructuras
                let aProducts = [];
                
                if (Array.isArray(response)) {
                    aProducts = response;
                    console.log("✅ Caso 1: Respuesta es array directo");
                } else if (response?.data?.[0]?.dataRes) {
                    aProducts = Array.isArray(response.data[0].dataRes) ? response.data[0].dataRes : [response.data[0].dataRes];
                    console.log("✅ Caso 2: data[0].dataRes");
                } else if (response?.dataRes) {
                    aProducts = Array.isArray(response.dataRes) ? response.dataRes : [response.dataRes];
                    console.log("✅ Caso 3: dataRes directo");
                } else if (response && typeof response === 'object') {
                    // Si es un objeto único, convertir a array
                    aProducts = [response];
                    console.log("✅ Caso 4: Objeto único convertido a array");
                }
                
                console.log("📊 Total productos extraídos:", aProducts.length);
                console.log("📊 Primer producto:", aProducts[0]);
                
                if (!Array.isArray(aProducts) || aProducts.length === 0) {
                    console.warn("⚠️ No se encontraron productos");
                    MessageBox.warning("No se encontraron productos en el sistema");
                    aProducts = [];
                }
                
                oModel.setProperty("/allProducts", aProducts);
                oModel.setProperty("/filteredProducts", aProducts);
                console.log("✅ Productos guardados en modelo");
                
                // Extraer marcas únicas
                const oMarcasSet = new Set();
                aProducts.forEach(p => {
                    if (p.MARCA) {
                        oMarcasSet.add(p.MARCA);
                    }
                });
                const aMarcas = Array.from(oMarcasSet);
                oModel.setProperty("/availableMarcas", aMarcas);
                console.log("🏷️ Marcas encontradas:", aMarcas.length, aMarcas);
                
                // Extraer categorías únicas
                const oCategorias = new Set();
                aProducts.forEach(p => {
                    if (Array.isArray(p.CATEGORIAS)) {
                        p.CATEGORIAS.forEach(cat => oCategorias.add(cat));
                    }
                });
                const aCategories = Array.from(oCategorias);
                oModel.setProperty("/allCategories", aCategories);
                console.log("📂 Categorías encontradas:", aCategories.length, aCategories);
                
                if (aProducts.length > 0) {
                    MessageToast.show(`${aProducts.length} productos cargados correctamente`);
                }
                
            } catch (error) {
                console.error("❌ Error completo al cargar productos:", error);
                console.error("❌ Stack:", error.stack);
                MessageBox.error("Error al cargar productos: " + error.message);
                // Establecer arrays vacíos en caso de error
                oModel.setProperty("/allProducts", []);
                oModel.setProperty("/filteredProducts", []);
                oModel.setProperty("/availableMarcas", []);
                oModel.setProperty("/allCategories", []);
            } finally {
                oModel.setProperty("/loading", false);
                console.log("🏁 Carga de productos finalizada");
            }
        },

        _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {
            console.log("🌐 _callApi iniciado");
            console.log("📍 URL relativa:", sRelativeUrl);
            console.log("📋 Parámetros:", oParams);
            
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }
            console.log("🗄️ DBServer:", oParams.DBServer || 'MongoDB (default)');

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }
            console.log("👤 LoggedUser:", oParams.LoggedUser);

            const sQueryString = new URLSearchParams(oParams).toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;
            
            console.log("🔗 URL completa:", sFullUrl);
            
            try {
                console.log("📤 Enviando request...");
                const oResponse = await fetch(sFullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(oData || {})
                });

                console.log("📥 Response status:", oResponse.status);
                console.log("📥 Response ok:", oResponse.ok);
                
                const sResponseText = await oResponse.text();
                console.log("📥 Response raw (primeros 1000 chars):", sResponseText.substring(0, 1000));

                if (!oResponse.ok) {
                    console.error("❌ Request failed with status:", oResponse.status);
                    try {
                        const oErrorJson = JSON.parse(sResponseText);
                        throw new Error(oErrorJson.message || oErrorJson.error || `Error ${oResponse.status}`);
                    } catch (parseError) {
                        throw new Error(`Error ${oResponse.status}: ${sResponseText}`);
                    }
                }

                const oJson = JSON.parse(sResponseText);
                console.log("📋 JSON parseado, keys:", Object.keys(oJson));
                console.log("📋 Estructura completa:", oJson);
                
                // Intentar extraer datos de múltiples estructuras posibles
                // Estructura 1: { value: [{ data: [{ dataRes: [...] }] }] }
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    console.log("🔍 Explorando value[0]...");
                    const mainResponse = oJson.value[0];
                    console.log("📦 mainResponse keys:", Object.keys(mainResponse));
                    
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        console.log("🔍 Explorando data[0]...");
                        const dataResponse = mainResponse.data[0];
                        console.log("📦 dataResponse keys:", Object.keys(dataResponse));
                        
                        if (dataResponse.dataRes) {
                            if (Array.isArray(dataResponse.dataRes)) {
                                console.log("✅ Extrayendo de value[0].data[0].dataRes (array):", dataResponse.dataRes.length);
                                return dataResponse.dataRes;
                            } else {
                                console.log("✅ Extrayendo de value[0].data[0].dataRes (objeto)");
                                return [dataResponse.dataRes];
                            }
                        }
                    }
                }
                
                // Estructura 2: { data: [{ dataRes: [...] }] }
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
                    console.log("🔍 Explorando data[0]...");
                    const dataResponse = oJson.data[0];
                    if (dataResponse.dataRes) {
                        if (Array.isArray(dataResponse.dataRes)) {
                            console.log("✅ Extrayendo de data[0].dataRes (array):", dataResponse.dataRes.length);
                            return dataResponse.dataRes;
                        } else {
                            console.log("✅ Extrayendo de data[0].dataRes (objeto)");
                            return [dataResponse.dataRes];
                        }
                    }
                }
                
                // Estructura 3: { dataRes: [...] }
                if (oJson && oJson.dataRes) {
                    if (Array.isArray(oJson.dataRes)) {
                        console.log("✅ Extrayendo de dataRes (array):", oJson.dataRes.length);
                        return oJson.dataRes;
                    } else {
                        console.log("✅ Extrayendo de dataRes (objeto)");
                        return [oJson.dataRes];
                    }
                }
                
                // Estructura 4: Respuesta es array directamente
                if (Array.isArray(oJson)) {
                    console.log("✅ Respuesta es array directo:", oJson.length);
                    return oJson;
                }
                
                console.warn("⚠️ Estructura de respuesta no reconocida, devolviendo JSON completo");
                return oJson;
                
            } catch (error) {
                console.error("❌ Error en _callApi:", error);
                console.error("❌ Error stack:", error.stack);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        onValidateStep1: function () {
            const oModel = this.getView().getModel("wizardModel");
            const sDESLISTA = oModel.getProperty("/DESLISTA");
            const sINSTITUTO = oModel.getProperty("/IDINSTITUTOOK");
            const sFechaIni = oModel.getProperty("/FECHAEXPIRAINI");
            const sFechaFin = oModel.getProperty("/FECHAEXPIRAFIN");
            
            const bValid = sDESLISTA && sINSTITUTO && sFechaIni && sFechaFin;
            oModel.setProperty("/canProceed", bValid);
        },

        onTipoGeneralChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/IDTIPOGENERALISTAOK", oEvent.getParameter("selectedItem").getKey());
        },

        onTipoFormulaChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/IDTIPOFORMULAOK", oEvent.getParameter("selectedItem").getKey());
        },

        onMarcasChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const aSelectedItems = oEvent.getParameter("selectedItems") || [];
            const aSelectedKeys = aSelectedItems.map(item => item.getKey());
            oModel.setProperty("/selectedMarcas", aSelectedKeys);
            console.log("Marcas seleccionadas:", aSelectedKeys);
            this._applyFilters();
        },

        onCategoriasChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const aSelectedItems = oEvent.getParameter("selectedItems") || [];
            const aSelectedKeys = aSelectedItems.map(item => item.getKey());
            oModel.setProperty("/selectedCategories", aSelectedKeys);
            console.log("Categorías seleccionadas:", aSelectedKeys);
            this._applyFilters();
        },

        onRangoPreciosChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const sKey = oEvent.getParameter("selectedItem").getKey();
            oModel.setProperty("/RANGO_PRECIOS", sKey);
            console.log("Rango de precio seleccionado:", sKey);
            this._applyFilters();
        },

        onSearchProduct: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || oEvent.getParameter("value") || "";
            oModel.setProperty("/searchTerm", sQuery);
            console.log("Búsqueda:", sQuery);
            this._applyFilters();
        },

        onClearFilters: function () {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/selectedMarcas", []);
            oModel.setProperty("/selectedCategories", []);
            oModel.setProperty("/RANGO_PRECIOS", "");
            oModel.setProperty("/searchTerm", "");
            
            // Limpiar los controles visuales
            const oComboMarcas = this.byId("comboMarcas");
            const oComboCategorias = this.byId("comboCategorias");
            const oSelectRango = this.byId("selectRangoPrecio");
            const oSearchField = this.byId("searchProducto");
            
            if (oComboMarcas) {
                oComboMarcas.setSelectedKeys([]);
            }
            if (oComboCategorias) {
                oComboCategorias.setSelectedKeys([]);
            }
            if (oSelectRango) {
                oSelectRango.setSelectedKey("");
            }
            if (oSearchField) {
                oSearchField.setValue("");
            }
            
            console.log("Filtros limpiados");
            this._applyFilters();
        },

        _applyFilters: function () {
            const oModel = this.getView().getModel("wizardModel");
            const aAllProducts = oModel.getProperty("/allProducts") || [];
            const aSelectedMarcas = oModel.getProperty("/selectedMarcas") || [];
            const aSelectedCategories = oModel.getProperty("/selectedCategories") || [];
            const sSearchTerm = (oModel.getProperty("/searchTerm") || "").toLowerCase();
            const sRangoPrecio = oModel.getProperty("/RANGO_PRECIOS");
            
            console.log("Aplicando filtros...");
            console.log("Total productos:", aAllProducts.length);
            console.log("Filtros activos:", {
                marcas: aSelectedMarcas,
                categorias: aSelectedCategories,
                busqueda: sSearchTerm,
                rango: sRangoPrecio
            });
            
            let aFiltered = aAllProducts.filter(product => {
                // Filtro por marcas
                if (aSelectedMarcas.length > 0) {
                    if (!product.MARCA || !aSelectedMarcas.includes(product.MARCA)) {
                        return false;
                    }
                }
                
                // Filtro por categorías
                if (aSelectedCategories.length > 0) {
                    if (!Array.isArray(product.CATEGORIAS) || product.CATEGORIAS.length === 0) {
                        return false;
                    }
                    const bHasCategory = product.CATEGORIAS.some(cat => aSelectedCategories.includes(cat));
                    if (!bHasCategory) {
                        return false;
                    }
                }
                
                // Filtro por búsqueda
                if (sSearchTerm) {
                    const bMatchSKU = product.SKUID && product.SKUID.toLowerCase().includes(sSearchTerm);
                    const bMatchName = product.PRODUCTNAME && product.PRODUCTNAME.toLowerCase().includes(sSearchTerm);
                    const bMatchMarca = product.MARCA && product.MARCA.toLowerCase().includes(sSearchTerm);
                    
                    if (!bMatchSKU && !bMatchName && !bMatchMarca) {
                        return false;
                    }
                }
                
                // Filtro por rango de precio (si implementas precios en productos)
                // Aquí podrías agregar lógica de filtro por precio si tus productos tienen ese campo
                
                return true;
            });
            
            console.log("Productos filtrados:", aFiltered.length);
            
            oModel.setProperty("/filteredProducts", aFiltered);
            
            // Contar filtros activos
            let iActiveFilters = 0;
            if (aSelectedMarcas.length > 0) iActiveFilters++;
            if (aSelectedCategories.length > 0) iActiveFilters++;
            if (sSearchTerm) iActiveFilters++;
            if (sRangoPrecio) iActiveFilters++;
            
            oModel.setProperty("/activeFilterCount", iActiveFilters);
            
            MessageToast.show(`${aFiltered.length} productos encontrados`);
        },

        onProductSelect: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oTable = this.byId("tableProductos");
            const aSelectedItems = oTable.getSelectedItems();
            
            const aSelectedProducts = aSelectedItems.map(item => item.getBindingContext("wizardModel").getObject());
            oModel.setProperty("/selectedProducts", aSelectedProducts);
            oModel.setProperty("/selectedProductsCount", aSelectedProducts.length);
            oModel.setProperty("/canProceed", aSelectedProducts.length > 0);
        },

        onWizardNext: function () {
            const oWizard = this.byId("wizardCrearLista");
            const oModel = this.getView().getModel("wizardModel");
            const iCurrentStep = oModel.getProperty("/currentStep");
            
            if (iCurrentStep === 4) {
                // Guardar
                this._saveLista();
            } else {
                // Siguiente paso
                oWizard.nextStep();
                oModel.setProperty("/currentStep", iCurrentStep + 1);
                
                if (iCurrentStep === 2) {
                    // Al pasar al paso 3, validar selección
                    oModel.setProperty("/canProceed", false);
                } else {
                    oModel.setProperty("/canProceed", true);
                }
            }
        },

        onWizardBack: function () {
            const oWizard = this.byId("wizardCrearLista");
            const oModel = this.getView().getModel("wizardModel");
            const iCurrentStep = oModel.getProperty("/currentStep");
            
            oWizard.previousStep();
            oModel.setProperty("/currentStep", iCurrentStep - 1);
            oModel.setProperty("/canProceed", true);
        },

        onWizardComplete: function () {
            this._saveLista();
        },

        _saveLista: async function () {
            const oModel = this.getView().getModel("wizardModel");
            const bIsEditing = oModel.getProperty("/isEditing");
            
            const aSelectedProducts = oModel.getProperty("/selectedProducts") || [];
            const aSKUIDs = aSelectedProducts.map(p => p.SKUID);
            
            if (aSKUIDs.length === 0) {
                MessageBox.error("Debes seleccionar al menos un producto.");
                return;
            }
            
            const sDESLISTA = oModel.getProperty("/DESLISTA");
            const sINSTITUTO = oModel.getProperty("/IDINSTITUTOOK");
            
            if (!sDESLISTA || !sINSTITUTO) {
                MessageBox.error("Completa todos los campos obligatorios.");
                return;
            }
            
            oModel.setProperty("/loading", true);
            
            try {
                const sIdListaOK = bIsEditing ? oModel.getProperty("/editingListaId") : `LISTA-${Date.now()}`;
                
                const payload = {
                    IDLISTAOK: sIdListaOK,
                    SKUSIDS: JSON.stringify(aSKUIDs),
                    IDINSTITUTOOK: sINSTITUTO.trim(),
                    IDLISTABK: "",
                    DESLISTA: sDESLISTA.trim(),
                    FECHAEXPIRAINI: oModel.getProperty("/FECHAEXPIRAINI"),
                    FECHAEXPIRAFIN: oModel.getProperty("/FECHAEXPIRAFIN"),
                    IDTIPOLISTAOK: oModel.getProperty("/IDTIPOLISTAOK") || "GENERAL",
                    IDTIPOGENERALISTAOK: oModel.getProperty("/IDTIPOGENERALISTAOK"),
                    IDTIPOFORMULAOK: oModel.getProperty("/IDTIPOFORMULAOK"),
                    REGUSER: oModel.getProperty("/REGUSER"),
                    ACTIVED: true,
                    DELETED: false
                };
                
                const sProcessType = bIsEditing ? 'UpdateOne' : 'AddOne';
                await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', payload, {
                    ProcessType: sProcessType
                });
                
                const sMessage = bIsEditing ? "Lista de precios actualizada correctamente" : "Lista de precios creada correctamente";
                MessageToast.show(sMessage);
                
                // Navegar de vuelta a la lista
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteListasPrecios", {}, true);
                
            } catch (error) {
                const sErrorMsg = bIsEditing ? "Error al actualizar la lista: " : "Error al crear la lista: ";
                MessageBox.error(sErrorMsg + error.message);
            } finally {
                oModel.setProperty("/loading", false);
            }
        },

        _formatDateForInput: function (date) {
            if (!date) return '';
            const d = new Date(date);
            const year = d.getUTCFullYear();
            const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
            const day = `${d.getUTCDate()}`.padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    });
});
