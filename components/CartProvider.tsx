
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_DISPLAY_CURRENCY,
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  type SupportedCurrency,
} from '../lib/currency';

export type DisplayCurrency = SupportedCurrency;

export type CartItem = {
  id: string;
  eventId: string;
  eventName: string;
  sport: string;
  eventDate?: string;
  category: string;
  session?: string;
  quantity: number;
  price?: number;
  currency?: string;

  // Optional supplier details.
  // Existing cart items do not need these fields.
  supplier?: 'XS2Event';
  supplierTicketId?: string;
  supplierCategoryId?: string;
  supplierEnvironment?: 'test';
  supplierRawNetRate?: number;
  supplierRawFaceValue?: number;
  maxQuantity?: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  total: number | null;
  currency: string | null;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
};

const CartContext =
  createContext<CartContextType | undefined>(
    undefined
  );

const CART_STORAGE_KEY =
  'grandstand-pass-cart';

const CURRENCY_STORAGE_KEY =
  'grandstand-pass-display-currency';

const MAX_CART_QUANTITY = 10;

export const DISPLAY_CURRENCIES:
  DisplayCurrency[] = [...SUPPORTED_CURRENCIES];

function isOptionalNonNegativeNumber(
  value: unknown
): boolean {
  return (
    value === undefined ||
    (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
    )
  );
}

/** Remove supplier cost information from cart state and browser storage. */
function sanitizeCartItem(item: CartItem): CartItem {
  const { supplierRawNetRate: _netRate, supplierRawFaceValue: _faceValue, ...safeItem } = item;
  void _netRate;
  void _faceValue;
  return safeItem;
}

function isOptionalPositiveInteger(
  value: unknown
): boolean {
  return (
    value === undefined ||
    (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1
    )
  );
}

function isCartItem(value: unknown): value is CartItem {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const item = value as Partial<CartItem>;

  const validSupplierDetails =
    (
      item.supplier === undefined ||
      item.supplier === 'XS2Event'
    ) &&
    (
      item.supplierTicketId === undefined ||
      (
        typeof item.supplierTicketId === 'string' &&
        item.supplierTicketId.length > 0
      )
    ) &&
    (
      item.supplierCategoryId === undefined ||
      typeof item.supplierCategoryId === 'string'
    ) &&
    (
      item.supplierEnvironment === undefined ||
      item.supplierEnvironment === 'test'
    ) &&
    isOptionalNonNegativeNumber(
      item.supplierRawNetRate
    ) &&
    isOptionalNonNegativeNumber(
      item.supplierRawFaceValue
    ) &&
    isOptionalPositiveInteger(
      item.maxQuantity
    );

  const validTestTicket =
    item.supplier !== 'XS2Event' ||
    (
      item.supplierEnvironment === 'test' &&
      typeof item.supplierTicketId === 'string' &&
      item.supplierTicketId.length > 0 &&
      item.id ===
        `xs2event-test:${item.supplierTicketId}` &&
      isSupportedCurrency(item.currency) &&
      typeof item.price === 'number' &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      typeof item.maxQuantity === 'number' &&
      Number.isInteger(item.maxQuantity) &&
      item.maxQuantity >= 1 &&
      item.quantity !== undefined &&
      item.quantity <= Math.min(
        MAX_CART_QUANTITY,
        item.maxQuantity
      )
    );

  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.eventId === 'string' &&
    item.eventId.length > 0 &&
    typeof item.eventName === 'string' &&
    item.eventName.length > 0 &&
    typeof item.sport === 'string' &&
    item.sport.length > 0 &&
    typeof item.category === 'string' &&
    item.category.length > 0 &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= MAX_CART_QUANTITY &&
    (
      item.price === undefined ||
      (
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        item.price >= 0
      )
    ) &&
    (
      item.currency === undefined ||
      typeof item.currency === 'string'
    ) &&
    validSupplierDetails &&
    validTestTicket
  );
}

function getItemQuantityLimit(
  item: CartItem
): number {
  if (
    typeof item.maxQuantity === 'number' &&
    Number.isInteger(item.maxQuantity) &&
    item.maxQuantity >= 1
  ) {
    return Math.min(
      MAX_CART_QUANTITY,
      item.maxQuantity
    );
  }

  return MAX_CART_QUANTITY;
}

function hasValidPricing(
  item: CartItem
): boolean {
  return (
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    isSupportedCurrency(item.currency)
  );
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [isLoaded, setIsLoaded] =
    useState(false);

  const [
    displayCurrency,
    setDisplayCurrencyState,
  ] = useState<DisplayCurrency>(
    DEFAULT_DISPLAY_CURRENCY
  );

  useEffect(() => {
    try {
      const savedCart =
        localStorage.getItem(
          CART_STORAGE_KEY
        );

      if (savedCart) {
        const parsed: unknown =
          JSON.parse(savedCart);

        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(isCartItem).map(sanitizeCartItem)
          );
        }
      }
    } catch (error) {
      console.error(
        'Unable to load shopping cart:',
        error
      );
    }

    try {
      const savedCurrency =
        localStorage.getItem(
          CURRENCY_STORAGE_KEY
        );

      if (
        isSupportedCurrency(
          savedCurrency
        )
      ) {
        setDisplayCurrencyState(
          savedCurrency
        );
      }
    } catch (error) {
      console.error(
        'Unable to load display currency:',
        error
      );
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(items.map(sanitizeCartItem))
      );
    } catch (error) {
      console.error(
        'Unable to save shopping cart:',
        error
      );
    }
  }, [items, isLoaded]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        CURRENCY_STORAGE_KEY,
        displayCurrency
      );
    } catch (error) {
      console.error(
        'Unable to save display currency:',
        error
      );
    }
  }, [
    displayCurrency,
    isLoaded,
  ]);

  const setDisplayCurrency = (
    nextCurrency: DisplayCurrency
  ) => {
    if (
      !isSupportedCurrency(
        nextCurrency
      )
    ) {
      return;
    }

    setDisplayCurrencyState(
      nextCurrency
    );
  };

  const addItem = (
    newItem: CartItem
  ) => {
    if (!isCartItem(newItem)) {
      return;
    }

    const safeNewItem = sanitizeCartItem(newItem);

    setItems((currentItems) => {
      const existingItem =
        currentItems.find(
          (item) =>
            item.id === safeNewItem.id
        );

      if (existingItem) {
        return currentItems.map(
          (item) => {
            if (
              item.id !== safeNewItem.id
            ) {
              return item;
            }

            // Do not combine unrelated supplier
            // offers that share a cart ID.
            if (
              item.supplierTicketId !==
              safeNewItem.supplierTicketId
            ) {
              return item;
            }

            const maxQuantity = Math.min(
              getItemQuantityLimit(item),
              getItemQuantityLimit(safeNewItem)
            );

            return {
              ...item,
              maxQuantity:
                item.supplier === 'XS2Event'
                  ? maxQuantity
                  : item.maxQuantity,
              quantity: Math.min(
                maxQuantity,
                item.quantity +
                  safeNewItem.quantity
              ),
            };
          }
        );
      }

      return [
        ...currentItems,
        safeNewItem,
      ];
    });
  };

  const removeItem = (
    id: string
  ) => {
    setItems(
      (currentItems) =>
        currentItems.filter(
          (item) =>
            item.id !== id
        )
    );
  };

  const updateQuantity = (
    id: string,
    quantity: number
  ) => {
    if (
      !Number.isInteger(quantity)
    ) {
      return;
    }

    if (
      quantity <= 0
    ) {
      removeItem(id);
      return;
    }

    setItems(
      (currentItems) =>
        currentItems.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  quantity: Math.min(
                    getItemQuantityLimit(item),
                    quantity
                  ),
                }
              : item
        )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount =
    items.reduce(
      (count, item) =>
        count +
        item.quantity,
      0
    );

  const hasCompletePricing =
    items.length > 0 &&
    items.every(
      hasValidPricing
    );

  const originalCurrencies =
    hasCompletePricing
      ? [
          ...new Set(
            items.map(
              (item) =>
                item.currency
            )
          ),
        ]
      : [];

  const currency =
    originalCurrencies.length === 1
      ? originalCurrencies[0] ??
        null
      : null;

  const total =
    hasCompletePricing &&
    currency !== null
      ? items.reduce(
          (sum, item) =>
            sum +
            (item.price ?? 0) *
              item.quantity,
          0
        )
      : null;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        total,
        currency,
        displayCurrency,
        setDisplayCurrency,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(
      CartContext
    );

  if (!context) {
    throw new Error(
      'useCart must be used within a CartProvider'
    );
  }

  return context;
}
