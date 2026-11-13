import { DataTypes } from 'sequelize';
import { sequelize } from './sequelize.js';

export const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(254),
    allowNull: false,
    unique: true
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  hashContrasena: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'usuarios',
  underscored: true,
  timestamps: false
});

export const Categoria = sequelize.define('Categoria', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'categorias',
  underscored: true,
  timestamps: false
});

export const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true
  },
  existencia: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  minimo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  descripcion: {
    type: DataTypes.STRING(500),
    allowNull: false,
    defaultValue: ''
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'productos',
  underscored: true,
  timestamps: false
});

export const Venta = sequelize.define('Venta', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  folio: {
    type: DataTypes.STRING(48),
    allowNull: false,
    unique: true
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'confirmada'
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ventas',
  underscored: true,
  timestamps: false
});

export const DetalleVenta = sequelize.define('DetalleVenta', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  precioUnitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'precio_unitario'
  }
}, {
  tableName: 'detalles_venta',
  underscored: true,
  timestamps: false,
  indexes: [{
    unique: true,
    fields: ['venta_id', 'producto_id']
  }]
});

export { sequelize };

Usuario.hasMany(Producto, {
  as: 'productos',
  foreignKey: 'propietarioId',
  onDelete: 'SET NULL'
});
Producto.belongsTo(Usuario, {
  as: 'propietario',
  foreignKey: 'propietarioId'
});
Categoria.hasMany(Producto, {
  as: 'productos',
  foreignKey: {
    name: 'categoriaId',
    allowNull: false
  },
  onDelete: 'RESTRICT'
});
Producto.belongsTo(Categoria, {
  as: 'categoria',
  foreignKey: {
    name: 'categoriaId',
    allowNull: false
  }
});
Usuario.hasMany(Venta, {
  as: 'ventas',
  foreignKey: {
    name: 'usuarioId',
    allowNull: false
  },
  onDelete: 'RESTRICT'
});
Venta.belongsTo(Usuario, {
  as: 'usuario',
  foreignKey: {
    name: 'usuarioId',
    allowNull: false
  }
});
Venta.hasMany(DetalleVenta, {
  as: 'detalles',
  foreignKey: {
    name: 'ventaId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});
DetalleVenta.belongsTo(Venta, {
  as: 'venta',
  foreignKey: {
    name: 'ventaId',
    allowNull: false
  }
});
Producto.hasMany(DetalleVenta, {
  as: 'detallesVenta',
  foreignKey: {
    name: 'productoId',
    allowNull: false
  },
  onDelete: 'RESTRICT'
});
DetalleVenta.belongsTo(Producto, {
  as: 'producto',
  foreignKey: {
    name: 'productoId',
    allowNull: false
  }
});
Venta.belongsToMany(Producto, {
  as: 'productos',
  through: DetalleVenta,
  foreignKey: 'ventaId',
  otherKey: 'productoId'
});
Producto.belongsToMany(Venta, {
  as: 'ventas',
  through: DetalleVenta,
  foreignKey: 'productoId',
  otherKey: 'ventaId'
});
