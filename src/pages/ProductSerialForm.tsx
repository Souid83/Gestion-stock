import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '../hooks/useNavigate';
import { useCategoryStore } from '../store/categoryStore';
import { useVariantStore } from '../store/variantStore';
import { ProductSelectionWindow } from '../components/Products/ProductSelectionWindow';
import { supabase } from '../lib/supabase';

interface Stock {
  id: string;
  name: string;
  group: {
    name: string;
    synchronizable: boolean;
  }[];
}

interface FormData {
  name: string;
  sku: string;
  serialNumber: string;
  purchasePrice: string;
  rawPurchasePrice: string;
  supplier: string;
  productNote: string;
  vat_type: '' | 'normal' | 'margin';
  batteryPercentage: string;
  warrantySticker: 'present' | 'absent' | '';
  selectedStock: string;
  category_id: string | null;
  weight_grams: string;
  width_cm: string;
  height_cm: string;
  depth_cm: string;
  description: string;
  ean: string;
  variants: any;
  retailPrice: {
    ht: string;
    margin: string;
    ttc: string;
  };
  proPrice: {
    ht: string;
    margin: string;
    ttc: string;
  };
}

const TVA_RATE = 0.20; // 20% TVA

const calculateTTC = (priceHT: number) => {
  return priceHT * (1 + TVA_RATE);
};

const calculateHT = (ttc: number): number => {
  return ttc / (1 + TVA_RATE);
};

const calculateMargin = (purchasePrice: number, sellingPrice: number): number => {
  if (!purchasePrice || !sellingPrice) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
};

export const ProductSerialForm: React.FC = () => {
  const { navigateToProduct } = useNavigate();
  const { categories, fetchCategories } = useCategoryStore();
  const { variants, fetchVariants } = useVariantStore();
  
  const [selectedCategory, setSelectedCategory] = useState({
    type: '',
    brand: '',
    model: ''
  });
  
  const [selectedVariant, setSelectedVariant] = useState({
    color: '',
    grade: '',
    capacity: ''
  });
  
  const [showProductSelection, setShowProductSelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    sku: string;
    category_id?: string;
    weight_grams?: number;
    width_cm?: number;
    height_cm?: number;
    depth_cm?: number;
    description?: string;
    ean?: string;
    variants?: any;
  } | null>(null);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    sku: '',
    serialNumber: '',
    purchasePrice: '',
    rawPurchasePrice: '',
    supplier: '',
    productNote: '',
    vat_type: '',
    batteryPercentage: '',
    warrantySticker: '',
    selectedStock: '',
    category_id: null,
    weight_grams: '',
    width_cm: '',
    height_cm: '',
    depth_cm: '',
    description: '',
    ean: '',
    variants: null,
    retailPrice: {
      ht: '',
      margin: '',
      ttc: ''
    },
    proPrice: {
      ht: '',
      margin: '',
      ttc: ''
    }
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchVariants();
    fetchStocks();
  }, [fetchCategories, fetchVariants]);

  useEffect(() => {
    console.log('Checking fields for product selection window:', {
      category: selectedCategory,
      variant: selectedVariant
    });
    
    if (
      selectedCategory.type && 
      selectedCategory.brand && 
      selectedCategory.model &&
      selectedVariant.color && 
      selectedVariant.grade && 
      selectedVariant.capacity
    ) {
      console.log('Opening product selection window');
      setShowProductSelection(true);
    }
  }, [selectedCategory, selectedVariant]);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          id,
          name,
          group:stock_groups (
            name,
            synchronizable
          )
        `)
        .order('name');

      if (error) throw error;
      setStocks((data as unknown as Stock[]) || []);
    } catch (err) {
      console.error('Error fetching stocks:', err);
      setError('Erreur lors de la récupération des stocks');
    }
  };

  const handleCategoryChange = (field: keyof typeof selectedCategory, value: string) => {
    console.log('handleCategoryChange:', field, value);
    const upperValue = value.toUpperCase();
    setSelectedCategory(prev => {
      const newData = { ...prev, [field]: upperValue };
      if (field === 'type') {
        newData.brand = '';
        newData.model = '';
      } else if (field === 'brand') {
        newData.model = '';
      }
      return newData;
    });
  };

  const handleVariantChange = (field: keyof typeof selectedVariant, value: string) => {
    console.log('handleVariantChange:', field, value);
    const upperValue = value.toUpperCase();
    setSelectedVariant(prev => ({ ...prev, [field]: upperValue }));
  };

  const handleProductSelect = async (product: { 
    id: string; 
    name: string; 
    sku: string;
    category_id?: string;
    weight_grams?: number;
    width_cm?: number;
    height_cm?: number;
    depth_cm?: number;
    description?: string;
    ean?: string;
    variants?: any;
  }) => {
    console.log('Selected product:', product);
    setSelectedProduct(product);
    setShowProductSelection(false);
    
    // Fetch complete product details
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', product.id)
        .single();
        
      if (error) throw error;
      
      console.log('Fetched complete product details:', data);
      
      setFormData(prev => ({
        ...prev,
        name: data.name,
        sku: data.sku,
        category_id: data.category_id,
        weight_grams: data.weight_grams?.toString() || '',
        width_cm: data.width_cm?.toString() || '',
        height_cm: data.height_cm?.toString() || '',
        depth_cm: data.depth_cm?.toString() || '',
        description: data.description || '',
        ean: data.ean || '',
        variants: data.variants
      }));
    } catch (err) {
      console.error('Error fetching complete product details:', err);
    }
  };

  const handleVATTypeChange = (type: 'normal' | 'margin') => {
    setFormData(prev => ({
      ...prev,
      vat_type: type
    }));
  };

  // Fonctions de calcul pour TVA normale
  const updateRetailPriceFromHT = (htValue: string) => {
    const ht = parseFloat(htValue);
    if (isNaN(ht)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      retailPrice: {
        ht: htValue,
        margin: margin.toFixed(2),
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateRetailPriceFromMargin = (marginValue: string) => {
    const margin = parseFloat(marginValue);
    if (isNaN(margin)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const ht = purchasePrice * (1 + margin / 100);
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      retailPrice: {
        ht: ht.toFixed(2),
        margin: marginValue,
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateRetailPriceFromTTC = (ttcValue: string) => {
    const ttc = parseFloat(ttcValue);
    if (isNaN(ttc)) return;

    const ht = ttc / (1 + TVA_RATE);
    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;

    setFormData(prev => ({
      ...prev,
      retailPrice: {
        ht: ht.toFixed(2),
        margin: margin.toFixed(2),
        ttc: ttcValue
      }
    }));
  };

  const updateProPriceFromHT = (htValue: string) => {
    const ht = parseFloat(htValue);
    if (isNaN(ht)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      proPrice: {
        ht: htValue,
        margin: margin.toFixed(2),
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateProPriceFromMargin = (marginValue: string) => {
    const margin = parseFloat(marginValue);
    if (isNaN(margin)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const ht = purchasePrice * (1 + margin / 100);
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      proPrice: {
        ht: ht.toFixed(2),
        margin: marginValue,
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateProPriceFromTTC = (ttcValue: string) => {
    const ttc = parseFloat(ttcValue);
    if (isNaN(ttc)) return;

    const ht = ttc / (1 + TVA_RATE);
    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;

    setFormData(prev => ({
      ...prev,
      proPrice: {
        ht: ht.toFixed(2),
        margin: margin.toFixed(2),
        ttc: ttcValue
      }
    }));
  };

  // Mise à jour des prix lorsque le prix d'achat change
  useEffect(() => {
    if (formData.vat_type === 'normal') {
      const purchasePrice = parseFloat(formData.purchasePrice);
      if (isNaN(purchasePrice)) return;

      // Mettre à jour le prix de vente magasin si déjà rempli
      if (formData.retailPrice.ht) {
        updateRetailPriceFromHT(formData.retailPrice.ht);
      } else if (formData.retailPrice.margin) {
        updateRetailPriceFromMargin(formData.retailPrice.margin);
      } else if (formData.retailPrice.ttc) {
        updateRetailPriceFromTTC(formData.retailPrice.ttc);
      }

      // Mettre à jour le prix de vente pro si déjà rempli
      if (formData.proPrice.ht) {
        updateProPriceFromHT(formData.proPrice.ht);
      } else if (formData.proPrice.margin) {
        updateProPriceFromMargin(formData.proPrice.margin);
      } else if (formData.proPrice.ttc) {
        updateProPriceFromTTC(formData.proPrice.ttc);
      }
    }
  }, [formData.purchasePrice, formData.vat_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form data:", formData);
    
    // Validation
    if (!formData.serialNumber) {
      setError("Le numéro de série est obligatoire");
      return;
    }
    
    if (!formData.selectedStock) {
      setError("Veuillez sélectionner un stock");
      return;
    }
    
    if (!formData.purchasePrice) {
      setError("Le prix d'achat avec frais est obligatoire");
      return;
    }
    
    if (!formData.warrantySticker) {
      setError("Veuillez indiquer si le sticker de garantie est présent ou absent");
      return;
    }
    
    if (!formData.supplier) {
      setError("Le fournisseur est obligatoire");
      return;
    }
    
    if (!selectedProduct) {
      setError("Aucun produit parent sélectionné");
      return;
    }
    
    try {
      // Préparer les données pour l'insertion
      const productData = {
        name: formData.name,
        sku: formData.sku,
        serial_number: formData.serialNumber,
        purchase_price_with_fees: parseFloat(formData.purchasePrice),
        raw_purchase_price: formData.rawPurchasePrice ? parseFloat(formData.rawPurchasePrice) : null,
        supplier: formData.supplier,
        product_note: formData.productNote || null,
        vat_type: formData.vat_type,
        battery_percentage: formData.batteryPercentage ? parseInt(formData.batteryPercentage) : null,
        warranty_sticker: formData.warrantySticker,
        stock_id: formData.selectedStock,
        parent_id: selectedProduct.id,
        is_parent: false,
        retail_price: formData.retailPrice.ht ? parseFloat(formData.retailPrice.ht) : null,
        pro_price: formData.proPrice.ht ? parseFloat(formData.proPrice.ht) : null,
        category_id: formData.category_id,
        weight_grams: parseInt(formData.weight_grams),
        width_cm: parseFloat(formData.width_cm),
        height_cm: parseFloat(formData.height_cm),
        depth_cm: parseFloat(formData.depth_cm),
        description: formData.description,
        ean: formData.ean,
        variants: formData.variants,
        stock: 1 // Un produit avec numéro de série a toujours un stock de 1
      };
      
      console.log("Inserting product data:", productData);
      
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();
        
      if (error) throw error;
      
      console.log("Product created successfully:", data);
      
      // Redirection vers la liste des produits
      navigateToProduct('product-list');
      
    } catch (err) {
      console.error("Error creating product:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de la création du produit");
    }
  };

  if (!selectedProduct) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigateToProduct('add-product-pam')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} className="mr-2" />
            Retour
          </button>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Category and Variant Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Sélection du produit</h2>

            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Catégorie</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nature du produit
                  </label>
                  <select
                    value={selectedCategory.type}
                    onChange={(e) => handleCategoryChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner la nature</option>
                    {Array.from(new Set(categories.map(c => c.type))).sort().map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marque
                  </label>
                  <select
                    value={selectedCategory.brand}
                    onChange={(e) => handleCategoryChange('brand', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.type}
                    required
                  >
                    <option value="">Sélectionner la marque</option>
                    {Array.from(new Set(categories
                      .filter(c => !selectedCategory.type || c.type === selectedCategory.type)
                      .map(c => c.brand)
                    )).sort().map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modèle
                  </label>
                  <select
                    value={selectedCategory.model}
                    onChange={(e) => handleCategoryChange('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.brand}
                    required
                  >
                    <option value="">Sélectionner le modèle</option>
                    {Array.from(new Set(categories
                      .filter(c => 
                        (!selectedCategory.type || c.type === selectedCategory.type) && 
                        (!selectedCategory.brand || c.brand === selectedCategory.brand)
                      )
                      .map(c => c.model)
                    )).sort().map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Variante</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur
                  </label>
                  <select
                    value={selectedVariant.color}
                    onChange={(e) => handleVariantChange('color', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner une couleur</option>
                    {Array.from(new Set(variants.map(v => v.color))).sort().map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade
                  </label>
                  <select
                    value={selectedVariant.grade}
                    onChange={(e) => handleVariantChange('grade', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner un grade</option>
                    {Array.from(new Set(variants.map(v => v.grade))).sort().map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacité
                  </label>
                  <select
                    value={selectedVariant.capacity}
                    onChange={(e) => handleVariantChange('capacity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner une capacité</option>
                    {Array.from(new Set(variants.map(v => v.capacity))).sort().map(capacity => (
                      <option key={capacity} value={capacity}>{capacity}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection Window */}
        {showProductSelection && (
          <ProductSelectionWindow
            isOpen={showProductSelection}
            onClose={() => setShowProductSelection(false)}
            onSelect={handleProductSelect}
            category={selectedCategory}
            variant={selectedVariant}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-8">
        <button
          onClick={() => setSelectedProduct(null)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Retour
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">Association du numéro de série</h2>

          {/* Product Info and VAT Selection */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit
                </label>
                <input
                  type="text"
                  value={formData.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* VAT Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de TVA <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleVATTypeChange('normal')}
                className={`px-4 py-2 rounded-md border ${
                  formData.vat_type === 'normal'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                TVA normale
              </button>
              <button
                type="button"
                onClick={() => handleVATTypeChange('margin')}
                className={`px-4 py-2 rounded-md border ${
                  formData.vat_type === 'margin'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                TVA sur marge
              </button>
            </div>
          </div>

          {/* Rest of the form - Only shown after VAT type selection */}
          {formData.vat_type && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de série <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    maxLength={15}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.serialNumber.length} / 15
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.selectedStock}
                    onChange={(e) => setFormData(prev => ({ ...prev, selectedStock: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Sélectionner un stock</option>
                    {stocks.map(stock => (
                      <option key={stock.id} value={stock.id}>
                        {stock.name} {stock.group.length > 0 ? `(${stock.group[0].name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pourcentage de batterie <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="batteryPercentage"
                      value={formData.batteryPercentage}
                      onChange={(e) => {
                        const value = e.target.value;
                        // N'autoriser que les chiffres
                        if (/^\d*$/.test(value)) {
                          const numValue = parseInt(value, 10);
                          // Bloquer si > 100 ou si vide
                          if (value === '' || (numValue >= 0 && numValue <= 100)) {
                            setFormData(prev => ({ ...prev, batteryPercentage: value }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          setFormData(prev => ({ ...prev, batteryPercentage: '0' }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      max="100"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sticker de garantie <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="warrantySticker"
                      value="present"
                      checked={formData.warrantySticker === 'present'}
                      onChange={(e) => setFormData(prev => ({ ...prev, warrantySticker: 'present' }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      required
                    />
                    <span className="ml-2">Présent</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="warrantySticker"
                      value="absent"
                      checked={formData.warrantySticker === 'absent'}
                      onChange={(e) => setFormData(prev => ({ ...prev, warrantySticker: 'absent' }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      required
                    />
                    <span className="ml-2">Absent</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix d'achat avec frais <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="purchasePrice"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix d'achat brut <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="rawPurchasePrice"
                      value={formData.rawPurchasePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, rawPurchasePrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix de vente magasin <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formData.vat_type === 'normal' ? 'Prix HT' : 'Prix de vente'}
                    </label>
                    <input
                      type="text"
                      value={formData.retailPrice.ht}
                      required
                      onChange={(e) => {
                        const value = e.target.value;
                        if (formData.vat_type === 'normal') {
                          updateRetailPriceFromHT(value);
                        } else {
                          // Logique TVA sur marge existante
                          const purchase = parseFloat(formData.purchasePrice);
                          const input = parseFloat(value);

                          if (!isNaN(purchase) && !isNaN(input)) {
                            const marginNet = (input - purchase) / 1.2;
                            const marginPct = (marginNet / purchase) * 100;
                            
                            setFormData(prev => ({
                              ...prev,
                              retailPrice: {
                                ht: value,
                                margin: marginPct.toFixed(2),
                                ttc: marginNet.toFixed(2)
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              retailPrice: {
                                ...prev.retailPrice,
                                ht: value
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Marge %
                    </label>
                    <input
                      type="text"
                      value={formData.retailPrice.margin}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (formData.vat_type === 'normal') {
                          updateRetailPriceFromMargin(value);
                        } else {
                          // Logique TVA sur marge existante
                          const purchase = parseFloat(formData.purchasePrice);
                          const input = parseFloat(value);

                          if (!isNaN(purchase) && !isNaN(input)) {
                            const marginNet = (purchase * input) / 100;
                            const selling = purchase + (marginNet * 1.2);
                            
                            setFormData(prev => ({
                              ...prev,
                              retailPrice: {
                                ht: selling.toFixed(2),
                                margin: value,
                                ttc: marginNet.toFixed(2)
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              retailPrice: {
                                ...prev.retailPrice,
                                margin: value
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                      %
                    </span>
                  </div>
                  {formData.vat_type === 'normal' ? (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Prix TTC
                      </label>
                      <input
                        type="text"
                        value={formData.retailPrice.ttc}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateRetailPriceFromTTC(value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Marge numéraire net
                      </label>
                      <input
                        type="text"
                        value={formData.retailPrice.ttc}
                        onChange={(e) => {
                          const value = e.target.value;
                          const purchase = parseFloat(formData.purchasePrice);
                          const input = parseFloat(value);

                          if (!isNaN(purchase) && !isNaN(input)) {
                            const selling = purchase + (input * 1.2);
                            const marginPct = (input / purchase) * 100;
                            
                            setFormData(prev => ({
                              ...prev,
                              retailPrice: {
                                ht: selling.toFixed(2),
                                margin: marginPct.toFixed(2),
                                ttc: value
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              retailPrice: {
                                ...prev.retailPrice,
                                ttc: value
                              }
                            }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix de vente pro <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formData.vat_type === 'normal' ? 'Prix HT' : 'Prix de vente'}
                    </label>
                    <input
                      type="text"
                      value={formData.proPrice.ht}
                      required
                      onChange={(e) => {
                        const value = e.target.value;
                        if (formData.vat_type === 'normal') {
                          updateProPriceFromHT(value);
                        } else {
                          // Logique TVA sur marge existante
                          const purchase = parseFloat(formData.purchasePrice);
                          const input = parseFloat(value);

                          if (!isNaN(purchase) && !isNaN(input)) {
                            const marginNet = (input - purchase) / 1.2;
                            const marginPct = (marginNet / purchase) * 100;
                            
                            setFormData(prev => ({
                              ...prev,
                              proPrice: {
                                ht: value,
                                margin: marginPct.toFixed(2),
                                ttc: marginNet.toFixed(2)
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              proPrice: {
                                ...prev.proPrice,
                                ht: value
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Marge %
                    </label>
                    <input
                      type="text"
                      value={formData.proPrice.margin}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (formData.vat_type === 'normal') {
                          updateProPriceFromMargin(value);
                        } else {
                          // Logique TVA sur marge existante
                          const purchase = parseFloat(formData.purchasePrice);
                          const input = parseFloat(value);

                          if (!isNaN(purchase) && !isNaN(input)) {
                            const marginNet = (purchase * input) / 100;
                            const selling = purchase + (marginNet * 1.2);
                            
                            setFormData(prev => ({
                              ...prev,
                              proPrice: {
                                ht: selling.toFixed(2),
                                margin: value,
                                ttc: marginNet.toFixed(2)
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              proPrice: {
                                ...prev.proPrice,
                                margin: value
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                      %
                    </span>
                  </div>
                  {formData.vat_type === 'normal' ? (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Prix TTC
                      </label>
                      <input
                        type="text"
                        value={formData.proPrice.ttc}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateProPriceFromTTC(value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Marge numéraire net
                      </label>
                      <input
                        type="text"
                        value={formData.proPrice.ttc}
                        onChange={(e) => {
                          const value = e.target.value;
                          const purchase = parseFloat(formData.purchasePrice);
                          const input = parseFloat(value);

                          if (!isNaN(purchase) && !isNaN(input)) {
                            const selling = purchase + (input * 1.2);
                            const marginPct = (input / purchase) * 100;
                            
                            setFormData(prev => ({
                              ...prev,
                              proPrice: {
                                ht: selling.toFixed(2),
                                margin: marginPct.toFixed(2),
                                ttc: value
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              proPrice: {
                                ...prev.proPrice,
                                ttc: value
                              }
                            }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  name="productNote"
                  value={formData.productNote}
                  onChange={(e) => setFormData(prev => ({ ...prev, productNote: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Associer le numéro de série
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};