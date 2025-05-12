import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Battery, BatteryLow, BatteryMedium, BatteryFull } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SerialNumberFormOverlay } from './SerialNumberFormOverlay';

interface SerialNumberListModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  serialProducts: Array<{
    id: string;
    serial_number: string;
    vat_type: 'normal' | 'margin';
    raw_purchase_price: number;
    purchase_price_with_fees: number;
    retail_price: number;
    pro_price: number;
    battery_percentage: number;
    supplier: string;
    product_note: string;
  }>;
}

export const SerialNumberListModal: React.FC<SerialNumberListModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  serialProducts
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showVatTypeSelector, setShowVatTypeSelector] = useState(false);
  const [showSerialForm, setShowSerialForm] = useState(false);
  const [selectedVatType, setSelectedVatType] = useState<'normal' | 'margin' | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [currentSerialProducts, setCurrentSerialProducts] = useState(serialProducts);
  const [parentProductDetails, setParentProductDetails] = useState<any>(null);

  useEffect(() => {
    setCurrentSerialProducts(serialProducts);
  }, [serialProducts]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchSerialProducts();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (productId) {
      fetchParentProductDetails();
    }
  }, [productId]);

  const fetchParentProductDetails = async () => {
    try {
      console.log('Fetching parent product details for ID:', productId);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
        
      if (error) throw error;
      
      console.log('Fetched parent product details:', data);
      setParentProductDetails(data);
    } catch (err) {
      console.error('Error fetching parent product details:', err);
    }
  };

  const fetchSerialProducts = async () => {
    try {
      console.log('Fetching serial products for parent ID:', productId);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('parent_id', productId);
        
      if (error) throw error;
      
      console.log('Fetched serial products:', data);
      setCurrentSerialProducts(data || []);
    } catch (err) {
      console.error('Error fetching serial products:', err);
    }
  };

  if (!isOpen) return null;

  const getBatteryStatusColor = (level: number) => {
    if (level >= 85) return 'text-green-600';
    if (level >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBatteryIcon = (level: number) => {
    if (level >= 85) return <BatteryFull className="text-green-600" size={18} />;
    if (level >= 80) return <BatteryMedium className="text-yellow-600" size={18} />;
    return <BatteryLow className="text-red-600" size={18} />;
  };

  const getMarginColor = (margin: number) => {
    if (margin < 10) return 'text-red-600';
    if (margin < 16) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleAddSerialNumber = () => {
    console.log('Opening VAT type selector for product ID:', productId);
    setShowVatTypeSelector(true);
  };

  const handleVatTypeSelect = (type: 'normal' | 'margin') => {
    console.log('Selected VAT type:', type);
    setSelectedVatType(type);
    setShowVatTypeSelector(false);
    setShowSerialForm(true);
  };

  const handleSerialFormClose = () => {
    setShowSerialForm(false);
    setSelectedVatType(null);
  };

  const handleSerialFormSubmit = () => {
    console.log('Serial form submitted successfully');
    setShowSerialForm(false);
    setSelectedVatType(null);
    // Refresh the list of serial products
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteSerialProduct = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit avec numéro de série ?')) {
      setIsDeleting(true);
      setDeletingId(id);
      setDeleteError(null);
      
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        // Refresh the list
        setCurrentSerialProducts(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        console.error('Error deleting serial product:', err);
        setDeleteError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression');
      } finally {
        setIsDeleting(false);
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Numéros de série</h2>
            <p className="text-gray-600">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {deleteError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {deleteError}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type de TVA
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro de série
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix d'achat brut
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix d'achat avec frais
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix vente magasin
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix vente pro
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batterie
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Note
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentSerialProducts.map((product) => {
                // Calcul des marges
                let retailMargin, proMargin, retailMarginValue, proMarginValue;
                
                if (product.vat_type === 'normal') {
                  // TVA normale: marge = (prix HT - prix d'achat) / prix d'achat * 100
                  retailMargin = ((product.retail_price - product.purchase_price_with_fees) / product.purchase_price_with_fees) * 100;
                  proMargin = ((product.pro_price - product.purchase_price_with_fees) / product.purchase_price_with_fees) * 100;
                  
                  // Marge numéraire = prix HT - prix d'achat
                  retailMarginValue = product.retail_price - product.purchase_price_with_fees;
                  proMarginValue = product.pro_price - product.purchase_price_with_fees;
                } else {
                  // TVA marge: marge numéraire net = (prix de vente - prix d'achat) / 1.2
                  retailMarginValue = (product.retail_price - product.purchase_price_with_fees) / 1.2;
                  proMarginValue = (product.pro_price - product.purchase_price_with_fees) / 1.2;
                  
                  // Marge % = (marge numéraire net * 100) / prix d'achat
                  retailMargin = (retailMarginValue * 100) / product.purchase_price_with_fees;
                  proMargin = (proMarginValue * 100) / product.purchase_price_with_fees;
                }
                
                return (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.vat_type === 'normal' ? 'TVA normale' : 'TVA marge'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.serial_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.raw_purchase_price?.toFixed(2) || '-'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.purchase_price_with_fees?.toFixed(2) || '-'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {product.vat_type === 'normal' ? (
                          <>
                            {product.retail_price?.toFixed(2) || '-'} € HT / {(product.retail_price * 1.2)?.toFixed(2) || '-'} € TTC
                          </>
                        ) : (
                          <>
                            {product.retail_price?.toFixed(2) || '-'} € TVM
                          </>
                        )}
                        <div className="flex items-center mt-1">
                          <span className={`text-xs ${getMarginColor(retailMargin)}`}>
                            {retailMargin.toFixed(2)}%
                          </span>
                          <span className="mx-1 text-xs text-gray-400">|</span>
                          <span className={`text-xs ${getMarginColor(retailMargin)}`}>
                            {retailMarginValue.toFixed(2)}€
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {product.vat_type === 'normal' ? (
                          <>
                            {product.pro_price?.toFixed(2) || '-'} € HT / {(product.pro_price * 1.2)?.toFixed(2) || '-'} € TTC
                          </>
                        ) : (
                          <>
                            {product.pro_price?.toFixed(2) || '-'} € TVM
                          </>
                        )}
                        <div className="flex items-center mt-1">
                          <span className={`text-xs ${getMarginColor(proMargin)}`}>
                            {proMargin.toFixed(2)}%
                          </span>
                          <span className="mx-1 text-xs text-gray-400">|</span>
                          <span className={`text-xs ${getMarginColor(proMargin)}`}>
                            {proMarginValue.toFixed(2)}€
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getBatteryStatusColor(product.battery_percentage)}`}>
                      <div className="flex items-center gap-1">
                        {getBatteryIcon(product.battery_percentage)}
                        <span>{product.battery_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.supplier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.product_note || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => handleDeleteSerialProduct(product.id)}
                        disabled={isDeleting && deletingId === product.id}
                        className={`text-red-600 hover:text-red-800 ${isDeleting && deletingId === product.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {currentSerialProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                    Aucun numéro de série associé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleAddSerialNumber}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} />
            Ajouter un numéro de série
          </button>
        </div>
      </div>
      
      {/* VAT Type Selector Overlay */}
      {showVatTypeSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Sélectionner le type de TVA</h2>
              <button
                onClick={() => setShowVatTypeSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-blue-800 font-medium">Produit parent: {productName}</p>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => handleVatTypeSelect('normal')}
                className="px-6 py-3 rounded-md border border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
              >
                TVA normale
              </button>
              <button
                type="button"
                onClick={() => handleVatTypeSelect('margin')}
                className="px-6 py-3 rounded-md border border-green-500 bg-green-50 text-green-700 hover:bg-green-100 font-medium"
              >
                TVA sur marge
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Serial Number Form Overlay */}
      {showSerialForm && selectedVatType && parentProductDetails && (
        <SerialNumberFormOverlay
          isOpen={showSerialForm}
          onClose={handleSerialFormClose}
          onSubmitSuccess={handleSerialFormSubmit}
          parentProduct={parentProductDetails}
          vatType={selectedVatType}
        />
      )}
    </div>
  );
};