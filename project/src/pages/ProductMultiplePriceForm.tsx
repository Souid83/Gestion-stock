import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '../hooks/useNavigate';
import { useProductStore } from '../store/productStore';
import { useCategoryStore } from '../store/categoryStore';
import { useVariantStore } from '../store/variantStore';
import { ImageManager } from '../components/Products/ImageManager';

export const ProductMultiplePriceForm: React.FC = () => {
  const { addProduct } = useProductStore();
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const { variants, fetchVariants } = useVariantStore();
  const { navigateToProduct } = useNavigate();

  const [vatType, setVatType] = useState<'normal' | 'margin' | null>(null);
  const [showVatSelector, setShowVatSelector] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    weight_grams: '',
    ean: '',
    description: '',
    width_cm: '',
    height_cm: '',
    depth_cm: '',
    purchase_price_with_fees: ''
  });

  const [selectedCategory, setSelectedCategory] = useState({
    type: '',
    brand: '',
    model: ''
  });

  const [selectedVariants, setSelectedVariants] = useState<{
    color: string;
    grade: string;
    capacity: string;
  }[]>([{
    color: '',
    grade: '',
    capacity: ''
  }]);

  const [retailPrice, setRetailPrice] = useState({
    ht: '',
    margin: '',
    ttc: ''
  });

  const [proPrice, setProPrice] = useState({
    ht: '',
    margin: '',
    ttc: ''
  });

  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchVariants();
  }, [fetchCategories, fetchVariants]);

  // Get unique values for category dropdowns
  const uniqueTypes = Array.from(new Set(categories.map(c => c.type))).sort();
  const uniqueBrands = Array.from(new Set(categories
    .filter(c => !selectedCategory.type || c.type === selectedCategory.type)
    .map(c => c.brand)
  )).sort();
  const uniqueModels = Array.from(new Set(categories
    .filter(c => 
      (!selectedCategory.type || c.type === selectedCategory.type) && 
      (!selectedCategory.brand || c.brand === selectedCategory.brand)
    )
    .map(c => c.model)
  )).sort();

  // Get unique values for variant dropdowns
  const uniqueColors = Array.from(new Set(variants.map(v => v.color))).sort();
  const uniqueGrades = Array.from(new Set(variants.map(v => v.grade))).sort();
  const uniqueCapacities = Array.from(new Set(variants.map(v => v.capacity))).sort();

  const handleCategoryChange = (field: keyof typeof selectedCategory, value: string) => {
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

    if (value) {
      const parts = [
        field === 'type' ? upperValue : selectedCategory.type,
        field === 'brand' ? upperValue : selectedCategory.brand,
        field === 'model' ? upperValue : selectedCategory.model
      ].filter(Boolean);
      
      if (parts.length > 0) {
        setFormData(prev => ({
          ...prev,
          name: parts.join(' ')
        }));
      }
    }
  };

  const handleVariantChange = (index: number, field: keyof (typeof selectedVariants)[0], value: string) => {
    const newVariants = [...selectedVariants];
    value = value.toUpperCase();
    newVariants[index] = {
      ...newVariants[index],
      [field]: value
    };
    setSelectedVariants(newVariants);
  };

  const handleVatTypeChange = (type: 'normal' | 'margin') => {
    console.log('Changing VAT type to:', type);
    setVatType(type);
    setShowVatSelector(false);
    
    // Reset price fields when changing VAT type
    setRetailPrice({
      ht: '',
      margin: '',
      ttc: ''
    });
    
    setProPrice({
      ht: '',
      margin: '',
      ttc: ''
    });
  };

  const TVA_RATE = 0.20;

  const calculateHT = (ttc: number): number => {
    return ttc / (1 + TVA_RATE);
  };

  const calculateTTC = (ht: number): number => {
    return ht * (1 + TVA_RATE);
  };

  const calculatePriceFromMargin = (purchasePrice: number, margin: number): number => {
    return purchasePrice * (1 + margin / 100);
  };

  const calculateMargin = (purchasePrice: number, sellingPrice: number): number => {
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  };

  const handleRetailPriceHTChange = (value: string) => {
    const ht = parseFloat(value);
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    
    if (isNaN(ht) || isNaN(purchasePrice)) {
      setRetailPrice(prev => ({ ...prev, ht: value }));
      return;
    }
    
    if (vatType === 'normal') {
      // TVA normale
      const margin = calculateMargin(purchasePrice, ht);
      const ttc = calculateTTC(ht);
      
      setRetailPrice({
        ht: value,
        margin: margin.toFixed(2),
        ttc: ttc.toFixed(2)
      });
    } else if (vatType === 'margin') {
      // TVA marge
      const margeBrute = ht - purchasePrice;
      const tvaAPayer = (margeBrute / 1.2) * 0.2;
      const margeNette = ht - tvaAPayer - purchasePrice;
      const margePercent = (margeNette * 100) / purchasePrice;
      
      setRetailPrice({
        ht: value,
        margin: margePercent.toFixed(2),
        ttc: margeNette.toFixed(2) // ttc field stores the net margin for TVA marge
      });
    }
  };

  const handleRetailPriceMarginChange = (value: string) => {
    const margin = parseFloat(value);
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    
    if (isNaN(margin) || isNaN(purchasePrice)) {
      setRetailPrice(prev => ({ ...prev, margin: value }));
      return;
    }
    
    if (vatType === 'normal') {
      // TVA normale
      const ht = calculatePriceFromMargin(purchasePrice, margin);
      const ttc = calculateTTC(ht);
      
      setRetailPrice({
        ht: ht.toFixed(2),
        margin: value,
        ttc: ttc.toFixed(2)
      });
    } else if (vatType === 'margin') {
      // TVA marge
      // For TVA marge, we need to calculate backwards from the margin percentage
      // This is an approximation as the exact formula would require solving a quadratic equation
      const margeNette = (purchasePrice * margin) / 100;
      const tvaEstimee = margeNette * 0.2;
      const margeBrute = margeNette + tvaEstimee;
      const prixVente = purchasePrice + margeBrute;
      
      setRetailPrice({
        ht: prixVente.toFixed(2),
        margin: value,
        ttc: margeNette.toFixed(2)
      });
    }
  };

  const handleRetailPriceTTCChange = (value: string) => {
    const ttc = parseFloat(value);
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    
    if (isNaN(ttc) || isNaN(purchasePrice)) {
      setRetailPrice(prev => ({ ...prev, ttc: value }));
      return;
    }
    
    if (vatType === 'normal') {
      // TVA normale
      const ht = calculateHT(ttc);
      const margin = calculateMargin(purchasePrice, ht);
      
      setRetailPrice({
        ht: ht.toFixed(2),
        margin: margin.toFixed(2),
        ttc: value
      });
    } else if (vatType === 'margin') {
      // TVA marge - in this case, ttc is actually the net margin amount
      const margeNette = ttc;
      const margePercent = (margeNette * 100) / purchasePrice;
      const tvaEstimee = margeNette * 0.2;
      const margeBrute = margeNette + tvaEstimee;
      const prixVente = purchasePrice + margeBrute;
      
      setRetailPrice({
        ht: prixVente.toFixed(2),
        margin: margePercent.toFixed(2),
        ttc: value
      });
    }
  };

  const handleProPriceHTChange = (value: string) => {
    const ht = parseFloat(value);
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    
    if (isNaN(ht) || isNaN(purchasePrice)) {
      setProPrice(prev => ({ ...prev, ht: value }));
      return;
    }
    
    if (vatType === 'normal') {
      // TVA normale
      const margin = calculateMargin(purchasePrice, ht);
      const ttc = calculateTTC(ht);
      
      setProPrice({
        ht: value,
        margin: margin.toFixed(2),
        ttc: ttc.toFixed(2)
      });
    } else if (vatType === 'margin') {
      // TVA marge
      const margeBrute = ht - purchasePrice;
      const tvaAPayer = (margeBrute / 1.2) * 0.2;
      const margeNette = ht - tvaAPayer - purchasePrice;
      const margePercent = (margeNette * 100) / purchasePrice;
      
      setProPrice({
        ht: value,
        margin: margePercent.toFixed(2),
        ttc: margeNette.toFixed(2) // ttc field stores the net margin for TVA marge
      });
    }
  };

  const handleProPriceMarginChange = (value: string) => {
    const margin = parseFloat(value);
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    
    if (isNaN(margin) || isNaN(purchasePrice)) {
      setProPrice(prev => ({ ...prev, margin: value }));
      return;
    }
    
    if (vatType === 'normal') {
      // TVA normale
      const ht = calculatePriceFromMargin(purchasePrice, margin);
      const ttc = calculateTTC(ht);
      
      setProPrice({
        ht: ht.toFixed(2),
        margin: value,
        ttc: ttc.toFixed(2)
      });
    } else if (vatType === 'margin') {
      // TVA marge
      // For TVA marge, we need to calculate backwards from the margin percentage
      // This is an approximation as the exact formula would require solving a quadratic equation
      const margeNette = (purchasePrice * margin) / 100;
      const tvaEstimee = margeNette * 0.2;
      const margeBrute = margeNette + tvaEstimee;
      const prixVente = purchasePrice + margeBrute;
      
      setProPrice({
        ht: prixVente.toFixed(2),
        margin: value,
        ttc: margeNette.toFixed(2)
      });
    }
  };

  const handleProPriceTTCChange = (value: string) => {
    const ttc = parseFloat(value);
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    
    if (isNaN(ttc) || isNaN(purchasePrice)) {
      setProPrice(prev => ({ ...prev, ttc: value }));
      return;
    }
    
    if (vatType === 'normal') {
      // TVA normale
      const ht = calculateHT(ttc);
      const margin = calculateMargin(purchasePrice, ht);
      
      setProPrice({
        ht: ht.toFixed(2),
        margin: margin.toFixed(2),
        ttc: value
      });
    } else if (vatType === 'margin') {
      // TVA marge - in this case, ttc is actually the net margin amount
      const margeNette = ttc;
      const margePercent = (margeNette * 100) / purchasePrice;
      const tvaEstimee = margeNette * 0.2;
      const margeBrute = margeNette + tvaEstimee;
      const prixVente = purchasePrice + margeBrute;
      
      setProPrice({
        ht: prixVente.toFixed(2),
        margin: margePercent.toFixed(2),
        ttc: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vatType) {
      setError('Veuillez sélectionner un type de TVA');
      return;
    }

    // Validate all required fields
    const requiredFields = [
      { field: 'name', label: 'Nom du produit' },
      { field: 'sku', label: 'SKU' },
      { field: 'purchase_price_with_fees', label: "Prix d'achat" },
      { field: 'weight_grams', label: 'Poids' },
      { field: 'ean', label: 'EAN' },
      { field: 'description', label: 'Description' },
      { field: 'width_cm', label: 'Largeur' },
      { field: 'height_cm', label: 'Hauteur' },
      { field: 'depth_cm', label: 'Profondeur' }
    ];

    for (const { field, label } of requiredFields) {
      if (!formData[field as keyof typeof formData]) {
        setError(`Le champ "${label}" est obligatoire`);
        return;
      }
    }

    // Validate category selection
    if (!selectedCategory.type || !selectedCategory.brand || !selectedCategory.model) {
      setError('Tous les champs de catégorie sont obligatoires');
      return;
    }

    // Validate variant selection
    if (!selectedVariants[0].color || !selectedVariants[0].grade || !selectedVariants[0].capacity) {
      setError('Tous les champs de variante sont obligatoires');
      return;
    }

    // Validate prices
    if (!retailPrice.ht || !proPrice.ht) {
      setError('Les prix de vente magasin et pro sont obligatoires');
      return;
    }

    try {
      let categoryId = null;
      
      const category = await addCategory({
        type: selectedCategory.type,
        brand: selectedCategory.brand,
        model: selectedCategory.model
      });
      
      if (category) {
        categoryId = category.id;
      }

      // Prepare base product data
      const productData: any = {
        name: formData.name,
        sku: formData.sku,
        purchase_price_with_fees: parseFloat(formData.purchase_price_with_fees),
        weight_grams: parseInt(formData.weight_grams),
        ean: formData.ean,
        description: formData.description,
        width_cm: parseFloat(formData.width_cm),
        height_cm: parseFloat(formData.height_cm),
        depth_cm: parseFloat(formData.depth_cm),
        images: productImages,
        category_id: categoryId,
        variants: selectedVariants,
        is_parent: true,
        vat_type: vatType
      };

      // Add price fields based on VAT type
      if (vatType === 'normal') {
        // TVA normale
        const retailHT = parseFloat(retailPrice.ht);
        const retailMargin = parseFloat(retailPrice.margin);
        const retailTTC = parseFloat(retailPrice.ttc);
        
        const proHT = parseFloat(proPrice.ht);
        const proMargin = parseFloat(proPrice.margin);
        const proTTC = parseFloat(proPrice.ttc);
        
        productData.retail_price = retailHT;
        productData.retail_price_ht = retailHT;
        productData.retail_margin = retailMargin;
        productData.retail_price_ttc = retailTTC;
        
        productData.pro_price = proHT;
        productData.pro_price_ht = proHT;
        productData.pro_margin = proMargin;
        productData.pro_price_ttc = proTTC;
      } else if (vatType === 'margin') {
        // TVA marge
        const retailPrice = parseFloat(retailPrice.ht);
        const retailMargin = parseFloat(retailPrice.margin);
        const retailMarginNet = parseFloat(retailPrice.ttc);
        
        const proPrice = parseFloat(proPrice.ht);
        const proMargin = parseFloat(proPrice.margin);
        const proMarginNet = parseFloat(proPrice.ttc);
        
        productData.retail_price = retailPrice;
        productData.retail_margin = retailMargin;
        productData.retail_margin_net = retailMarginNet;
        
        productData.pro_price = proPrice;
        productData.pro_margin = proMargin;
        productData.pro_margin_net = proMarginNet;
      }

      console.log('Creating parent product with data:', productData);
      const result = await addProduct(productData);
      if (result?.id) {
        console.log('Parent product created successfully with ID:', result.id);
        navigateToProduct('product-list');
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Une erreur est survenue lors de l\'enregistrement du produit.');
    }
  };

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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Ajouter un produit</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* VAT Type Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de TVA <span className="text-red-500">*</span>
            </label>
            {vatType && (
              <button
                type="button"
                onClick={() => setShowVatSelector(!showVatSelector)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Changer de TVA
              </button>
            )}
          </div>
          
          {!vatType || showVatSelector ? (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleVatTypeChange('normal')}
                className={`px-4 py-2 rounded-md border ${
                  vatType === 'normal'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                TVA normale
              </button>
              <button
                type="button"
                onClick={() => handleVatTypeChange('margin')}
                className={`px-4 py-2 rounded-md border ${
                  vatType === 'margin'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                TVA sur marge
              </button>
            </div>
          ) : (
            <div className="px-4 py-2 bg-gray-100 rounded-md inline-block">
              {vatType === 'normal' ? 'TVA normale' : 'TVA sur marge'}
            </div>
          )}
        </div>

        {vatType && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Catégorie du produit</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nature du produit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCategory.type}
                    onChange={(e) => handleCategoryChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner la nature</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marque <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCategory.brand}
                    onChange={(e) => handleCategoryChange('brand', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.type}
                    required
                  >
                    <option value="">Sélectionner la marque</option>
                    {uniqueBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modèle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCategory.model}
                    onChange={(e) => handleCategoryChange('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.brand}
                    required
                  >
                    <option value="">Sélectionner le modèle</option>
                    {uniqueModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Variantes du produit */}
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Variantes du produit</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedVariants[0].color}
                    onChange={(e) => handleVariantChange(0, 'color', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner une couleur</option>
                    {uniqueColors.map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedVariants[0].grade}
                    onChange={(e) => handleVariantChange(0, 'grade', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner un grade</option>
                    {uniqueGrades.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacité <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedVariants[0].capacity}
                    onChange={(e) => handleVariantChange(0, 'capacity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner une capacité</option>
                    {uniqueCapacities.map(capacity => (
                      <option key={capacity} value={capacity}>{capacity}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  placeholder="Nom du produit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  placeholder="SKU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EAN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ean"
                  value={formData.ean}
                  onChange={(e) => setFormData(prev => ({ ...prev, ean: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Code EAN"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poids (grammes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="weight_grams"
                  value={formData.weight_grams}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight_grams: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  placeholder="Poids en grammes"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {vatType === 'margin' ? "Prix d'achat brut" : "Prix d'achat HT"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="purchase_price_with_fees"
                  value={formData.purchase_price_with_fees}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchase_price_with_fees: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  placeholder="Prix d'achat"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  HT
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dimensions du produit <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div className="relative">
                  <input
                    type="number"
                    name="width_cm"
                    value={formData.width_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, width_cm: e.target.value }))}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md"
                    placeholder="Largeur"
                    step="0.1"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    cm
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    name="height_cm"
                    value={formData.height_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, height_cm: e.target.value }))}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md"
                    placeholder="Hauteur"
                    step="0.1"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    cm
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    name="depth_cm"
                    value={formData.depth_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, depth_cm: e.target.value }))}
                    className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md"
                    placeholder="Profondeur"
                    step="0.1"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    cm
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix de vente magasin <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {vatType === 'margin' ? 'Prix de vente' : 'Prix HT'}
                  </label>
                  <input
                    type="text"
                    value={retailPrice.ht}
                    onChange={(e) => handleRetailPriceHTChange(e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md"
                    placeholder="Prix HT"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {vatType === 'margin' ? 'TTC' : 'HT'}
                  </span>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Marge %
                  </label>
                  <input
                    type="text"
                    value={retailPrice.margin}
                    onChange={(e) => handleRetailPriceMarginChange(e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-green-600"
                    placeholder="Marge"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                    %
                  </span>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {vatType === 'margin' ? 'Marge numéraire net' : 'Prix TTC'}
                  </label>
                  <input
                    type="text"
                    value={retailPrice.ttc}
                    onChange={(e) => handleRetailPriceTTCChange(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
                    placeholder={vatType === 'margin' ? 'Marge numéraire' : 'Prix TTC'}
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {vatType === 'margin' ? '€' : 'TTC'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix de vente pro <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {vatType === 'margin' ? 'Prix de vente' : 'Prix HT'}
                  </label>
                  <input
                    type="text"
                    value={proPrice.ht}
                    onChange={(e) => handleProPriceHTChange(e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md"
                    placeholder="Prix HT"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {vatType === 'margin' ? 'TTC' : 'HT'}
                  </span>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Marge %
                  </label>
                  <input
                    type="text"
                    value={proPrice.margin}
                    onChange={(e) => handleProPriceMarginChange(e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-green-600"
                    placeholder="Marge"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                    %
                  </span>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {vatType === 'margin' ? 'Marge numéraire net' : 'Prix TTC'}
                  </label>
                  <input
                    type="text"
                    value={proPrice.ttc}
                    onChange={(e) => handleProPriceTTCChange(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
                    placeholder={vatType === 'margin' ? 'Marge numéraire' : 'Prix TTC'}
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {vatType === 'margin' ? '€' : 'TTC'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                required
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsImageManagerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Gestion des images ({productImages.length})
              </button>
            </div>

            <div className="mt-6 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigateToProduct('add-product-pam')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Enregistrer
              </button>
            </div>
          </>
        )}
      </form>

      <ImageManager
        isOpen={isImageManagerOpen}
        onClose={() => setIsImageManagerOpen(false)}
        onImagesChange={setProductImages}
        currentImages={productImages}
      />
    </div>
  );
};