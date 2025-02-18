import { ClientFunction } from 'testcafe';
import createWidget, { disposeWidgets } from '../../../helpers/createWidget';
import url from '../../../helpers/getPageUrl';
import Scheduler from '../../../model/scheduler';

fixture.disablePageReloads`Appointment Editing`
  .page(url(__dirname, '../../container.html'))
  .afterEach(async () => disposeWidgets());

test('Should correctly update appointment if dataSource is a simple array', async (t) => {
  const scheduler = new Scheduler('#container');
  const expectedSubject = 'appt-01updated';
  const appointment = scheduler.getAppointment('appt-01');
  const updatedAppointment = scheduler.getAppointment(expectedSubject);
  const { appointmentPopup } = scheduler;

  await t
    .doubleClick(appointment.element)
    .click(appointmentPopup.subjectElement)
    .typeText(appointmentPopup.subjectElement, 'updated')
    .expect(appointmentPopup.subjectElement.value)
    .eql(expectedSubject)
    .click(appointmentPopup.doneButton)
    .expect(updatedAppointment.element.exists)
    .ok();
}).before(async () => createWidget('dxScheduler', {
  dataSource: [{
    id: 1,
    text: 'appt-01',
    startDate: new Date(2021, 2, 29, 9, 30),
    endDate: new Date(2021, 2, 29, 11, 30),
  }],
  views: ['day'],
  currentView: 'day',
  currentDate: new Date(2021, 2, 29),
  startDayHour: 9,
  endDayHour: 14,
  height: 600,
}, true));

test('Should correctly update appointment if dataSource is a Store with key array', async (t) => {
  const scheduler = new Scheduler('#container');
  const expectedSubject = 'appt-01updated';
  const appointment = scheduler.getAppointment('appt-01');
  const updatedAppointment = scheduler.getAppointment(expectedSubject);
  const { appointmentPopup } = scheduler;

  await t
    .doubleClick(appointment.element)
    .click(appointmentPopup.subjectElement)
    .typeText(appointmentPopup.subjectElement, 'updated')
    .expect(appointmentPopup.subjectElement.value)
    .eql(expectedSubject)
    .click(appointmentPopup.doneButton)
    .expect(updatedAppointment.element.exists)
    .ok();
}).before(async () => ClientFunction(() => {
  (window as any).widget = ($('#container') as any)
    .dxScheduler({
      dataSource: new (window as any).DevExpress.data.DataSource({
        store: {
          type: 'array',
          key: 'id',
          data: [{
            id: 1,
            text: 'appt-01',
            startDate: new Date(2021, 2, 29, 9, 30),
            endDate: new Date(2021, 2, 29, 11, 30),
          }],
        },
      }),
      views: ['day'],
      currentView: 'day',
      currentDate: new Date(2021, 2, 29),
      startDayHour: 9,
      endDayHour: 14,
      height: 600,
    })
    .dxScheduler('instance');
  (window as any).DevExpress.fx.off = true;
})());
