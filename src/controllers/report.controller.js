const reportService = require('../services/report.service');

const monthlyBookings = async (req, res) => {
  const { filename, csv } = await reportService.monthlyBookings(req.query);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
  res.status(200).send(csv);
};
module.exports = { monthlyBookings };
