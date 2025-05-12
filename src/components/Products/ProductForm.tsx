import React, { useState, useEffect, useRef } from 'react';
import { Package, Bell, DollarSign, Settings, Users, ShoppingBag, Cloud, PenTool as Tool, Box, Layers, Image as ImageIcon, Download, Upload, ArrowDown, Plus } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { useCategoryStore } from '../../store/categoryStore';
import { ImageManager } from './ImageManager';
import { StockAllocationModal } from './StockAllocationModal';
import { supabase } from '../../lib/supabase';
import { ImportDialog } from '../ImportProgress/ImportDialog';
import { useCSVImport } from '../../hooks/useCSVImport';

const TVA_RATE = 0.20;

interface PriceInputs {
  ht: string;
  margin: string;
  ttc: string;
}

interface ProductFormProps {
  initialProduct?: {
    id: string;
    name: string;
    sku: string;
    purchase_price_with_fees: number;
    retail_price: number;
    pro_price: number;
    weight_grams: number;
    location?: string;
    ean: string | null;
    stock: number;
    stock_alert: number | null;
    description: string | null;
    width_cm?: number | null;
    height_cm?: number | null;
    depth_cm?: number | null;
    images?: string[];
    vat_type?: 'normal' | 'margin' | null;
    category?: {
      type: string;
      brand: string;
      model: string;
    } | null;
  };
  onSubmitSuccess?: () => void;
  showImageManager?: boolean;
  isParentProduct?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialProduct,
  onSubmitSuccess,
  showImageManager = false,
  isParentProduct = false
}) => {
  const { addProduct, updateProduct } = useProductStore();
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  const [vatType, setVatType] = useState<'normal' | 'margin' | null>(initialProduct?.vat_type || null);
  const [showVatSelector, setShowVatSelector] = useState(false);

  const [formData, setFormData] = useState({
    name: initialProduct?.name || '',
    sku: initialProduct?.sku || '',
    purchase_price_with_fees: initialProduct?.purchase_price_with_fees?.toString() || '',
    weight_grams: initialProduct?.weight_grams?.toString() || '',
    location: initialProduct?.location || '',
    ean: initialProduct?.ean || '',
    stock: initialProduct?.stock?.toString() || '',
    stock_alert: initialProduct?.stock_alert?.toString() || '',
    description: initialProduct?.description || '',
    width_cm: initialProduct?.width_cm?.toString() || '',
    height_cm: initialProduct?.height_cm?.toString() || '',
    depth_cm: initialProduct?.depth_cm?.toString() || ''
  });

  const [selectedCategory, setSelectedCategory] = useState({
    type: initialProduct?.category?.type || '',
    brand: initialProduct?.category?.brand || '',
    model: initialProduct?.category?.model || ''
  });

  const [retailPrice, setRetailPrice] = useState<PriceInputs>({
    ht: initialProduct?.retail_price?.toString() || '',
    margin: '',
    ttc: ''
  });

  const [proPrice, setProPrice] = useState<PriceInputs>({
    ht: initialProduct?.pro_price?.toString() || '',
    margin: '',
    ttc: ''
  });

  const [isImageManagerOpen, setIsImageManagerOpen] = useState(showImageManager);
  const [productImages, setProductImages] = useState<string[]>(initialProduct?.images || []);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [globalStock, setGlobalStock] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setIsImageManagerOpen(showImageManager);
  }, [showImageManager]);

  useEffect(() => {
    // Set initial VAT type if editing a product
    if (initialProduct?.vat_type) {
      setVatType(initialProduct.vat_type);
    }
  }, [initialProduct]);

  useEffect(() => {
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    if (!isNaN(purchasePrice) && purchasePrice > 0) {
      if (retailPrice.ht) {
        const retailHT = parseFloat(retailPrice.ht);
        if (!isNaN(retailHT)) {
          if (vatType === 'normal') {
            // TVA normale
            setRetailPrice(prev => ({
              ...prev,
              margin: calculateMargin(purchasePrice, retailHT).toFixed(2),
              ttc: calculateTTC(retailHT).toFixed(2)
            }));
          } else if (vatType === 'margin') {
            // TVA marge
            const margeBrute = retailHT - purchasePrice;
            const tvaAPayer = (margeBrute / 1.2) * 0.2;
            const margeNette = retailHT - tvaAPayer - purchasePrice;
            const margePercent = (margeNette * 100) / purchasePrice;
            
            setRetailPrice(prev => ({
              ...prev,
              margin: margePercent.toFixed(2),
              ttc: margeNette.toFixed(2) // ttc field stores the net margin for TVA marge
            }));
          }
        }
      }

      if (proPrice.ht) {
        const proHT = parseFloat(proPrice.ht);
        if (!isNaN(proHT)) {
          if (vatType === 'normal') {
            // TVA normale
            setProPrice(prev => ({
              ...prev,
              margin: calculateMargin(purchasePrice, proHT).toFixed(2),
              ttc: calculateTTC(proHT).toFixed(2)
            }));
          } else if (vatType === 'margin') {
            // TVA marge
            const margeBrute = proHT - purchasePrice;
            const tvaAPayer = (margeBrute / 1.2) * 0.2;
            const margeNette = proHT - tvaAPayer - purchasePrice;
            const margePercent = (margeNette * 100) / purchasePrice;
            
            setProPrice(prev => ({
              ...prev,
              margin: margePercent.toFixed(2),
              ttc: margeNette.toFixed(2) // ttc field stores the net margin for TVA marge
            }));
          }
        }
      }
    }
  }, [formData.purchase_price_with_fees, vatType]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'description') {
      setFormData(prev => ({ ...prev, [name]: value }));
      return;
    }

    const numericFields = [
      'ean',
      'weight_grams',
      'stock',
      'stock_alert',
      'width_cm',
      'height_cm',
      'depth_cm',
      'purchase_price_with_fees'
    ];

    if (numericFields.includes(name)) {
      if (/^\d*$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

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

  const handleVatTypeChange = (type: 'normal' | 'margin') => {
    console.log('Changing VAT type to:', type);
    setVatType(type);
    setShowVatSelector(false);
    
    // Recalculate prices based on new VAT type
    const purchasePrice = parseFloat(formData.purchase_price_with_fees);
    if (!isNaN(purchasePrice) && purchasePrice > 0) {
      if (retailPrice.ht) {
        const retailHT = parseFloat(retailPrice.ht);
        if (!isNaN(retailHT)) {
          if (type === 'normal') {
            // TVA normale
            setRetailPrice(prev => ({
              ...prev,
              margin: calculateMargin(purchasePrice, retailHT).toFixed(2),
              ttc: calculateTTC(retailHT).toFixed(2)
            }));
          } else if (type === 'margin') {
            // TVA marge
            const margeBrute = retailHT - purchasePrice;
            const tvaAPayer = (margeBrute / 1.2) * 0.2;
            const margeNette = retailHT - tvaAPayer - purchasePrice;
            const margePercent = (margeNette * 100) / purchasePrice;
            
            setRetailPrice(prev => ({
              ...prev,
              margin: margePercent.toFixed(2),
              ttc: margeNette.toFixed(2) // ttc field stores the net margin for TVA marge
            }));
          }
        }
      }

      if (proPrice.ht) {
        const proHT = parseFloat(proPrice.ht);
        if (!isNaN(proHT)) {
          if (type === 'normal') {
            // TVA normale
            setProPrice(prev => ({
              ...prev,
              margin: calculateMargin(purchasePrice, proHT).toFixed(2),
              ttc: calculateTTC(proHT).toFixed(2)
            }));
          } else if (type === 'margin') {
            // TVA marge
            const margeBrute = proHT - purchasePrice;
            const tvaAPayer = (margeBrute / 1.2) * 0.2;
            const margeNette = proHT - tvaAPayer - purchasePrice;
            const margePercent = (margeNette * 100) / purchasePrice;
            
            setProPrice(prev => ({
              ...prev,
              margin: margePercent.toFixed(2),
              ttc: margeNette.toFixed(2) // ttc field stores the net margin for TVA marge
            }));
          }
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split(',').map(h => h.trim());
      const products = rows.slice(1).map(row => {
        const values = row.split(',');
        const product: any = {};
        headers.forEach((header, index) => {
          product[header.trim()] = values[index]?.trim() || '';
        });
        return product;
      });

      startImport(products.length);
      setError(null);
      const importErrors: { line: number; message: string }[] = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        try {
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id, stock')
            .eq('sku', product.sku)
            .single();

          const category = await addCategory({
            type: product.category_type.toUpperCase(),
            brand: product.category_brand.toUpperCase(),
            model: product.category_model.toUpperCase()
          });

          const productData = {
            name: product.name,
            sku: product.sku,
            purchase_price_with_fees: parseFloat(product.purchase_price_with_fees),
            retail_price: parseFloat(product.retail_price),
            pro_price: parseFloat(product.pro_price),
            weight_grams: parseInt(product.weight_grams),
            location: (product.location || '').toUpperCase(),
            ean: existingProduct?.ean || product.ean,
            stock: parseInt(product.stock),
            stock_alert: product.stock_alert ? parseInt(product.stock_alert) : null,
            description: product.description || null,
            width_cm: product.width_cm ? parseFloat(product.width_cm) : null,
            height_cm: product.height_cm ? parseFloat(product.height_cm) : null,
            depth_cm: product.depth_cm ? parseFloat(product.depth_cm) : null,
            category_id: category?.id || null,
            vat_type: product.vat_type || 'normal'
          };

          if (existingProduct) {
            await updateProduct(existingProduct.id, {
              ...productData,
              stock: existingProduct.stock + parseInt(product.stock)
            });
          } else {
            await addProduct(productData);
          }

          incrementProgress();
        } catch (err) {
          console.error('Error processing product:', product.sku, err);
          importErrors.push({
            line: i + 2,
            message: `Erreur avec le produit ${product.sku}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
          });
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (importErrors.length > 0) {
        setImportError(importErrors);
      } else {
        setImportSuccess(`${products.length} produits importés avec succès`);
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      setImportError([{
        line: 0,
        message: 'Erreur lors de l\'importation du fichier CSV'
      }]);
    }
  };

  const downloadSampleCSV = () => {
    const headers = [
      'name',
      'sku',
      'purchase_price_with_fees',
      'retail_price',
      'pro_price',
      'weight_grams',
      'location',
      'ean',
      'stock',
      'stock_alert',
      'description',
      'width_cm',
      'height_cm',
      'depth_cm',
      'category_type',
      'category_brand',
      'category_model',
      'vat_type'
    ];

    const sampleData = [
      'iPhone 14 Pro Max',
      'IP14PM-128-BLK',
      '900',
      '1200',
      '1100',
      '240',
      'STOCK-A1',
      '123456789012',
      '10',
      '3',
      'iPhone 14 Pro Max 128Go Noir',
      '7.85',
      '16.07',
      '0.78',
      'SMARTPHONE',
      'APPLE',
      'IPHONE 14 PRO MAX',
      'normal'
    ];

    const csvContent = [
      headers.join(','),
      sampleData.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'products_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    if (!vatType && !isParentProduct) {
      setError('Veuillez sélectionner un type de TVA');
      return;
    }

    // Validate all required fields
    const requiredFields = [
      { field: 'name', label: 'Nom du produit' },
      { field: 'sku', label: 'SKU' },
      { field: 'purchase_price_with_fees', label: "Prix d'achat" },
      { field: 'weight_grams', label: 'Poids' },
      { field: 'location', label: 'Localisation' },
      { field: 'ean', label: 'EAN' },
      { field: 'stock', label: 'Stock' },
      { field: 'stock_alert', label: "Alerte stock" },
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

      const productData = {
        name: formData.name,
        sku: formData.sku,
        purchase_price_with_fees: parseFloat(formData.purchase_price_with_fees),
        retail_price: parseFloat(retailPrice.ht || '0'),
        pro_price: parseFloat(proPrice.ht || '0'),
        weight_grams: parseInt(formData.weight_grams),
        location: formData.location.toUpperCase(),
        ean: formData.ean,
        stock: parseInt(formData.stock),
        stock_alert: parseInt(formData.stock_alert),
        description: formData.description,
        width_cm: parseFloat(formData.width_cm),
        height_cm: parseFloat(formData.height_cm),
        depth_cm: parseFloat(formData.depth_cm),
        images: productImages,
        category_id: categoryId,
        // Only update vat_type if not a parent product
        ...(isParentProduct ? {} : { vat_type: vatType })
      };

      console.log('Saving product with data:', productData);

      if (initialProduct) {
        await updateProduct(initialProduct.id, productData);
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        const result = await addProduct(productData);
        if (result?.id) {
          setNewProductId(result.id);
          setNewProductName(result.name);
          setGlobalStock(parseInt(formData.stock));
          setIsStockModalOpen(true);
        }
      }

      if (!initialProduct) {
        setFormData({
          name: '',
          sku: '',
          purchase_price_with_fees: '',
          weight_grams: '',
          location: '',
          ean: '',
          stock: '',
          stock_alert: '',
          description: '',
          width_cm: '',
          height_cm: '',
          depth_cm: ''
        });
        setSelectedCategory({ type: '', brand: '', model: '' });
        setRetailPrice({ ht: '', margin: '', ttc: '' });
        setProPrice({ ht: '', margin: '', ttc: '' });
        setProductImages([]);
        setVatType(null);
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Une erreur est survenue lors de l\'enregistrement du produit.');
    }
  };

  return (
    <div className="space-y-6">
      {!isParentProduct && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-blue-700">Vous avez plusieurs produits à créer ? 📦</p>
              <ArrowDown className="text-blue-500 animate-bounce" size={20} />
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={downloadSampleCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Download size={18} />
                Télécharger un modèle CSV 📥
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
                <Upload size={18} />
                Importer un fichier CSV 📂
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {initialProduct ? 'Modifier le produit' : 'Ajouter un produit'}
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* VAT Type Selection - Only show for non-parent products */}
        {!isParentProduct && (
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
        )}

        {/* For parent products, we don't need to wait for VAT type selection */}
        {(vatType || isParentProduct) && (
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
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
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  placeholder="SKU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localisation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    location: e.target.value.toUpperCase() 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="EMPLACEMENT"
                  required
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
                  onChange={handleChange}
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
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  placeholder="Poids en grammes"
                />
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
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                    placeholder="Prix d'achat"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    HT
                  </span>
                </div>
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock global <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alerte stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="stock_alert"
                  value={formData.stock_alert}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
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
                <ImageIcon size={20} />
                Gestion des images ({productImages.length})
              </button>
            </div>

            <div>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {initialProduct ? 'Mettre à jour' : 'Ajouter le produit'}
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

      <StockAllocationModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          if (onSubmitSuccess) {
            onSubmitSuccess();
          }
        }}
        productId={newProductId || ''}
        productName={newProductName}
        globalStock={globalStock}
      />

      <ImportDialog
        isOpen={importState.isDialogOpen}
        onClose={closeDialog}
        current={importState.current}
        total={importState.total}
        status={importState.status}
        errors={importState.errors}
      />
    </div>
  );
};